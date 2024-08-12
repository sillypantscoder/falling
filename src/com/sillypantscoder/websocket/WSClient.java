package src.com.sillypantscoder.websocket;

import org.java_websocket.WebSocket;

public class WSClient {
	public WebSocket websocket;
	public String path;
	public WSClient(WebSocket websocket, String path) {
		this.websocket = websocket;
		this.path = path;
	}
	public void send(String data) {
		this.websocket.send(data);
	}
}
