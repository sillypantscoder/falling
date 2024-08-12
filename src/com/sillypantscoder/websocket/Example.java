package src.com.sillypantscoder.websocket;

import java.io.IOException;
import java.util.ArrayList;

public class Example {
	public static void main(String[] args) {
		WSServer server = new WSServer(new Server(), 8891);
		server.start();
		try {
			System.in.read();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
	public static class Server extends AbstractWSServer {
		public ArrayList<WSClient> clients;
		public Server() {
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
}
