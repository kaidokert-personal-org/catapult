// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package webpagereplay

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"sync"
)

var ErrNotFound = errors.New("not found")

// ClientSessions contains a map that records a session id for a given client IP address.
// The Archive object uses a ClientSessions object to track the current session id for any connected clients.
// Each ArchivedRequest inside the Archive object uses a ClientSessions object to track the last session when
// wprGo matched the ArchivedRequest with an incoming request from a client.
// Together these ClientSessions objects allow Archive to keep track which request the Archive has served, and
// to which client. The Archive uses this state information to serve ArchivedRequests in the chronological
// sequence in which the recording was made.
type ClientSessions struct {
	SessionIds map[string]uint32
	StartingSessionId uint32
}

func (c *ClientSessions) getSessionId(remoteAddr string) uint32 {
	val, exists := c.SessionIds[remoteAddr]
	if !exists {
		return c.StartingSessionId
	}
	return val
}

func (c *ClientSessions) incrementSessionId(remoteAddr string) {
	val, exists := c.SessionIds[remoteAddr]
	if !exists {
		c.SessionIds[remoteAddr] = 0
	} else {
		c.SessionIds[remoteAddr] = val + 1; // An int32 value will wrap around if the value overflows.
	}
}

func newClientSessions(startingSessionId uint32) ClientSessions {
	return ClientSessions{SessionIds: make(map[string]uint32), StartingSessionId: startingSessionId}
}

// ArchivedRequest contains a single request and its response.
// Immutable after creation.
type ArchivedRequest struct {
	SerializedRequest []byte
	SerializedResponse []byte // if empty, the request failed
	LastServedSession ClientSessions
}

// RequestMatch represents a match when querying the archive for responses to a request
type RequestMatch struct {
	Match *ArchivedRequest
	Request *http.Request
	Response *http.Response
	MatchRatio float64
}

func serializeRequest(req *http.Request, resp *http.Response) (*ArchivedRequest, error) {
	url := req.URL.String()
	ar := &ArchivedRequest{}
	{
		var buf bytes.Buffer
		if err := req.Write(&buf); err != nil {
			return nil, fmt.Errorf("failed writing request for %s: %v", url, err)
		}
		ar.SerializedRequest = buf.Bytes()
	}
	{
		var buf bytes.Buffer
		if err := resp.Write(&buf); err != nil {
			return nil, fmt.Errorf("failed writing response for %s: %v", url, err)
		}
		ar.SerializedResponse = buf.Bytes()
	}
	return ar, nil
}

func (ar *ArchivedRequest) unmarshal() (*http.Request, *http.Response, error) {
	req, err := http.ReadRequest(bufio.NewReader(bytes.NewReader(ar.SerializedRequest)))
	if err != nil {
		return nil, nil, fmt.Errorf("couldn't unmarshal request: %v", err)
	}
	resp, err := http.ReadResponse(bufio.NewReader(bytes.NewReader(ar.SerializedResponse)), req)
	if err != nil {
		if req.Body != nil {
			req.Body.Close()
		}
		return nil, nil, fmt.Errorf("couldn't unmarshal response: %v", err)
	}
	return req, resp, nil
}

// Archive contains an archive of requests. Immutable except when embedded in a WritableArchive.
// Fields are exported to enabled JSON encoding.
type Archive struct {
	// Requests maps host(url) => url => []request.
	// The two-level mapping makes it easier to search for similar requests.
	// There may be multiple requests for a given URL.
	Requests map[string]map[string][]*ArchivedRequest
	// Maps host string to DER encoded certs.
	Certs map[string][]byte
	// Maps host string to the negotiated protocol. eg. "http/1.1" or "h2"
	// If absent, will default to "http/1.1".
	NegotiatedProtocol map[string]string
	// The time seed that was used to initialize deterministic.js.
	DeterministicTimeSeedMs int64
	// When an incoming request matches multiple recorded responses, whether to serve the responses
	// in the chronological sequence in which wpr_go recorded them.
	ServeResponseInChronologicalSequence bool
	// Maps host a client's IP address to the client's current session id.
	// Archive can serve responses in chronological order to each client. If a client wants to reset the Archive
	// to serve responses from the start, the client may do so by incrementing its session id.
	CurrentSession ClientSessions
}

func newArchive() Archive {
	return Archive {Requests: make(map[string]map[string][]*ArchivedRequest)}
}

func prepareArchiveForReplay(a *Archive) {
	// Initialize the session id mechanism that Archive uses to keep state information about clients.
	a.CurrentSession = newClientSessions(1)
	for _, urlmap := range a.Requests {
		for _, requests := range urlmap {
			for _, ar := range requests {
				ar.LastServedSession = newClientSessions(0)
			}
		}
	}
}

// OpenArchive opens an archive file previously written by OpenWritableArchive.
func OpenArchive(path string) (*Archive, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("could not open %s: %v", path, err)
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return nil, fmt.Errorf("gunzip failed: %v", err)
	}
	defer gz.Close()
	buf, err := ioutil.ReadAll(gz)
	if err != nil {
		return nil, fmt.Errorf("read failed: %v", err)
	}
	a := newArchive()
	if err := json.Unmarshal(buf, &a); err != nil {
		return nil, fmt.Errorf("json unmarshal failed: %v", err)
	}
	prepareArchiveForReplay(&a);
	return &a, nil
}

// ForEach applies f to all requests in the archive.
func (a *Archive) ForEach(f func(url *url.URL, req *http.Request, resp *http.Response) bool) {
	for _, urlmap := range a.Requests {
		for urlString, requests := range urlmap {
			fullURL, _ := url.Parse(urlString)
			for k, ar := range requests {
				req, resp, err := ar.unmarshal()
				if err != nil {
					log.Printf("Error unmarshaling request #%d for %s: %v", k, urlString, err)
					continue
				}
				if !f(fullURL, req, resp) {
					return
				}
			}
		}
	}
}

// Returns the der encoded cert and negotiated protocol.
func (a *Archive) FindHostTlsConfig(host string) ([]byte, string, error) {
	if cert, ok := a.Certs[host]; ok {
		return cert, a.findHostNegotiatedProtocol(host), nil
	}
	return nil, "", ErrNotFound
}

func (a *Archive) findHostNegotiatedProtocol(host string) string {
	if negotiatedProtocol, ok := a.NegotiatedProtocol[host]; ok {
		return negotiatedProtocol
	}
	return "http/1.1"
}

// FindRequest searches for the given request in the archive.
// Returns ErrNotFound if the request could not be found. Does not consume req.Body.
// TODO: conditional requests
func (a *Archive) FindRequest(req *http.Request, scheme string) (*http.Request, *http.Response, error) {
	hostMap := a.Requests[req.Host]
	if len(hostMap) == 0 {
		return nil, nil, ErrNotFound
	}

	// Exact match. Note that req may be relative, but hostMap keys are always absolute.
	u := *req.URL
	if u.Host == "" {
		u.Host = req.Host
		u.Scheme = scheme
	}
	reqUrl := u.String()

	if len(hostMap[reqUrl]) > 0 {
		return a.findBestMatchInArchivedRequestSet(req, hostMap[reqUrl], a.CurrentSession.getSessionId(req.RemoteAddr))
	}

	// For all URLs with a matching path, pick the URL that has the most matching query parameters.
	// The match ratio is defined to be 2*M/T, where
	//   M = number of matches x where a.Query[x]=b.Query[x]
	//   T = sum(len(a.Query)) + sum(len(b.Query))
	aq := req.URL.Query()

	var bestURL string
	var bestRatio float64

	for ustr := range hostMap {
		u, err := url.Parse(ustr)
		if err != nil {
			continue
		}
		if u.Path != req.URL.Path {
			continue
		}
		bq := u.Query()
		m := 1
		t := len(aq) + len(bq)
		for k, v := range aq {
			if reflect.DeepEqual(v, bq[k]) {
				m++
			}
		}
		ratio := 2 * float64(m) / float64(t)
		if ratio > bestRatio ||
			// Map iteration order is non-deterministic, so we must break ties.
			(ratio == bestRatio && ustr < bestURL) {
			bestURL = ustr
			bestRatio = ratio
		}
	}

	if bestURL != "" {
		return a.findBestMatchInArchivedRequestSet(req, hostMap[bestURL], a.CurrentSession.getSessionId(req.RemoteAddr))
	}

	return nil, nil, ErrNotFound
}

// Given an incoming request and a set of matches in the archive, identify the best match,
// based on request headers, request cookies, data and other information.
func (a *Archive) findBestMatchInArchivedRequestSet(incomingReq *http.Request, archivedReqs []*ArchivedRequest, sessionId uint32) (*http.Request, *http.Response, error) {
	if len(archivedReqs) == 1 {
		archivedReq, archivedResp, err := archivedReqs[0].unmarshal()
		if err != nil {
			log.Println("Error unmarshaling request")
			return nil, nil, err
		}
		return archivedReq, archivedResp, err
	} else if len(archivedReqs) > 0 {
		// There can be multiple requests with the same URL string. If that's the case,
		// break the tie by the number of headers that match.
		var bestMatch RequestMatch
		var bestInSequenceMatch RequestMatch

		for _, r := range archivedReqs {
			archivedReq, archivedResp, err := r.unmarshal()
			if err != nil {
				log.Println("Error unmarshaling request")
				continue
			}

			// Skip this archived request if the request methods does not match that of the incoming request.
			if archivedReq.Method != incomingReq.Method {
				continue
			}

			// Count the number of header matches
			numMatchingHeaders := 1
			numTotalHeaders := len(incomingReq.Header) + len(archivedReq.Header)
			for key, val := range archivedReq.Header {
				if reflect.DeepEqual(val, incomingReq.Header[key]) {
					numMatchingHeaders++
				}
			}
			// Note that since |m| starts from 1. The ratio will be more than 0
			// even if no header matches.
			ratio := 2 * float64(numMatchingHeaders) / float64(numTotalHeaders)

			if a.ServeResponseInChronologicalSequence &&
				r.LastServedSession.getSessionId(incomingReq.RemoteAddr) != sessionId &&
				ratio > bestInSequenceMatch.MatchRatio {
				bestInSequenceMatch.Match = r
				bestInSequenceMatch.Request = archivedReq
				bestInSequenceMatch.Response = archivedResp
				bestInSequenceMatch.MatchRatio = ratio
			}
			if ratio > bestMatch.MatchRatio {
				bestMatch.Match = r
				bestMatch.Request = archivedReq
				bestMatch.Response = archivedResp
				bestMatch.MatchRatio = ratio
			}
		}

		if a.ServeResponseInChronologicalSequence &&
			bestInSequenceMatch.Match != nil {
			bestInSequenceMatch.Match.LastServedSession.SessionIds[incomingReq.RemoteAddr] = sessionId
			return bestInSequenceMatch.Request, bestInSequenceMatch.Response, nil
		} else if bestMatch.Match != nil {
			bestMatch.Match.LastServedSession.SessionIds[incomingReq.RemoteAddr] = sessionId
			return bestMatch.Request, bestMatch.Response, nil
		}
	}
	return nil, nil, ErrNotFound
}

func (a *Archive) addArchivedRequest(scheme string, req *http.Request, resp *http.Response) error {
	ar, err := serializeRequest(req, resp)
	if err != nil {
		return err
	}
	if a.Requests[req.Host] == nil {
		a.Requests[req.Host] = make(map[string][]*ArchivedRequest)
	}
	// Always use the absolute URL in this mapping.
	u := *req.URL
	if u.Host == "" {
		u.Host = req.Host
		u.Scheme = scheme
	}
	ustr := u.String()
	a.Requests[req.Host][ustr] = append(a.Requests[req.Host][ustr], ar)
	return nil
}

func (a *Archive) resetClientSession(clientRemoteAddress string) {
	a.CurrentSession.incrementSessionId(clientRemoteAddress)
}

// Edit iterates over all requests in the archive. For each request, it calls f to
// edit the request. If f returns a nil pair, the request is deleted.
// The edited archive is returned, leaving the current archive is unchanged.
func (a *Archive) Edit(edit func(req *http.Request, resp *http.Response) (*http.Request, *http.Response, error)) (*Archive, error) {
	clone := newArchive()
	var resultErr error
	a.ForEach(func(fullURL *url.URL, oldReq *http.Request, oldResp *http.Response) bool {
		newReq, newResp, err := edit(oldReq, oldResp)
		if err != nil {
			resultErr = err
			return false
		}
		if newReq == nil || newResp == nil {
			if newReq != nil || newResp != nil {
				panic("programming error: newReq/newResp must both be nil or non-nil")
			}
			return true
		}
		// TODO: allow changing scheme or protocol?
		resultErr = clone.addArchivedRequest(fullURL.Scheme, newReq, newResp)
		return resultErr != nil
	})
	if resultErr != nil {
		return nil, resultErr
	}
	return &clone, nil
}

// Merge adds all the request of the provided archive to the receiver.
func (a *Archive) Merge(other *Archive) error {
	var cerr error
	var numAddedRequests = 0
	var numSkippedRequests = 0
	other.ForEach(func(fullURL *url.URL, req *http.Request, resp *http.Response) bool {
		if foundReq, _, notFoundErr := a.FindRequest(req, fullURL.Scheme); notFoundErr == ErrNotFound {
			cerr = a.addArchivedRequest(fullURL.Scheme, req, resp)
			numAddedRequests++
		} else {
			// Add requests if the query doesn't fully match.
			if !reflect.DeepEqual(foundReq, req) {
				cerr = a.addArchivedRequest(fullURL.Scheme, req, resp)
				numAddedRequests++
			} else {
				numSkippedRequests++
			}
		}
		return cerr == nil
	})
	log.Printf("Merged requests: added=%d duplicates=%d \n", numAddedRequests, numSkippedRequests)
	return cerr
}

// Serialize serializes this archive to the given writer.
func (a *Archive) Serialize(w io.Writer) error {
	gz := gzip.NewWriter(w)
	if err := json.NewEncoder(gz).Encode(a); err != nil {
		return fmt.Errorf("json marshal failed: %v", err)
	}
	return gz.Close()
}

// WriteableArchive wraps an Archive with writable methods for recording.
// The file is not flushed until Close is called. All methods are thread-safe.
type WritableArchive struct {
	Archive
	f  *os.File
	mu sync.Mutex
}

// OpenWritableArchive opens an archive file for writing.
// The output is gzipped JSON.
func OpenWritableArchive(path string) (*WritableArchive, error) {
	f, err := os.Create(path)
	if err != nil {
		return nil, fmt.Errorf("could not open %s: %v", path, err)
	}
	return &WritableArchive{Archive: newArchive(), f: f}, nil
}

// RecordRequest records a request/response pair in the archive.
func (a *WritableArchive) RecordRequest(scheme string, req *http.Request, resp *http.Response) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.addArchivedRequest(scheme, req, resp)
}

// RecordTlsConfig records the cert used and protocol negotiated for a host.
func (a *WritableArchive) RecordTlsConfig(host string, der_bytes []byte, negotiatedProtocol string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.Certs == nil {
		a.Certs = make(map[string][]byte)
	}
	if _, ok := a.Certs[host]; !ok {
		a.Certs[host] = der_bytes
	}
	if a.NegotiatedProtocol == nil {
		a.NegotiatedProtocol = make(map[string]string)
	}
	a.NegotiatedProtocol[host] = negotiatedProtocol
}

// Close flushes the the archive and closes the output file.
func (a *WritableArchive) Close() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	defer func() { a.f = nil }()
	if a.f == nil {
		return errors.New("already closed")
	}

	if err := a.Serialize(a.f); err != nil {
		return err
	}
	return a.f.Close()
}
