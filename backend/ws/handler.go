package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins (desktop app — frontend is always localhost)
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ServeWs upgrades the HTTP connection to WebSocket and registers the client.
// Pass the JWT as a query parameter: /ws?token=<jwt>
// Connections without a valid token are still accepted but will not receive
// user-targeted events (only org-wide broadcasts).
func ServeWs(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract userId from token — optional, non-blocking
		userID := ""
		if tokenStr := c.Query("token"); tokenStr != "" {
			if uid, err := utils.VerifyToken(tokenStr); err == nil {
				userID = uid
			}
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("WebSocket upgrade error:", err)
			return
		}

		cl := &client{conn: conn, send: make(chan []byte, 256), userID: userID}
		hub.register <- cl

		// Write pump
		go func() {
			ticker := time.NewTicker(54 * time.Second)
			defer func() {
				ticker.Stop()
				conn.Close()
			}()
			for {
				select {
				case msg, ok := <-cl.send:
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if !ok {
						conn.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						return
					}
				case <-ticker.C:
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Read pump — keeps connection alive and handles client disconnect
		go func() {
			defer func() {
				hub.unregister <- cl
				conn.Close()
			}()
			conn.SetReadLimit(512)
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			conn.SetPongHandler(func(string) error {
				conn.SetReadDeadline(time.Now().Add(60 * time.Second))
				return nil
			})
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		}()
	}
}
