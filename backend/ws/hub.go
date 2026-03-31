package ws

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

// Event is the message broadcast to connected clients.
type Event struct {
	Type    string      `json:"type"`             // e.g. "customers_updated", "notification"
	Action  string      `json:"action,omitempty"` // "create" | "update" | "delete"
	ID      string      `json:"id,omitempty"`
	Payload interface{} `json:"payload,omitempty"` // arbitrary data for typed events
}

// client represents a single WebSocket connection.
type client struct {
	conn   *websocket.Conn
	send   chan []byte
	userID string // authenticated user — empty if token was missing/invalid
}

// Hub manages all active WebSocket clients.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*client]bool
	broadcast  chan []byte
	register   chan *client
	unregister chan *client
}

// GlobalHub is the singleton hub used by controllers.
var GlobalHub = NewHub()

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *client),
		unregister: make(chan *client),
	}
}

// Run starts the hub's event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.Lock()
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					close(c.send)
					delete(h.clients, c)
				}
			}
			h.mu.Unlock()
		}
	}
}

// Broadcast sends an Event to every connected client.
func (h *Hub) Broadcast(evt Event) {
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	h.broadcast <- data
}

// BroadcastToUser sends raw JSON only to connections belonging to userID.
func (h *Hub) BroadcastToUser(userID string, data []byte) {
	if userID == "" {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.userID == userID {
			select {
			case c.send <- data:
			default:
				// slow client — skip, don't drop (notification will still be in DB)
			}
		}
	}
}

// SendEventToUser marshals an Event and sends it only to the given user.
func (h *Hub) SendEventToUser(userID string, evt Event) {
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	h.BroadcastToUser(userID, data)
}
