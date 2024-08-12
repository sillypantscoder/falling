package src.com.sillypantscoder.falling;

import java.util.ArrayList;

import src.com.sillypantscoder.websocket.AbstractWSServer;
import src.com.sillypantscoder.websocket.WSClient;

public class FallingWSServer extends AbstractWSServer {
	public ArrayList<WSClient> clients;
	public FallingWSServer() {
		clients = new ArrayList<WSClient>();
	}
	public void connect(WSClient client) {
		clients.add(client);
		clients.forEach((v) -> v.send("client connected"));
	}
	public void message(WSClient client, String message) {
		clients.forEach((v) -> v.send("client sent message: " + message));
	}
	public void disconnect(WSClient client) {
		clients.remove(client);
		clients.forEach((v) -> v.send("client left"));
	}
}
