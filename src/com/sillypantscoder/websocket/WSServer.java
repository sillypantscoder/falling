package src.com.sillypantscoder.websocket;

import java.io.IOException;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.ByteBuffer;
import java.util.HashMap;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

public class WSServer extends WebSocketServer {
	public AbstractWSServer server;
	public HashMap<WebSocket, WSClient> clients;
	public WSServer(AbstractWSServer server, int port) {
		super(new InetSocketAddress("0.0.0.0", port));
		this.server = server;
		this.clients = new HashMap<WebSocket, WSClient>();
		Runtime.getRuntime().addShutdownHook(new Thread(() -> {
			System.out.println("Stopping the server");
			this.getConnections().forEach((v) -> {
				v.close();
				System.out.println("disconnected from " + v);
			});
			try {
				this.stop(1000);
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
			waitForPort(port);
		}));
	}
	@Override
	public void onOpen(WebSocket conn, ClientHandshake handshake) {
		// Add new client
		WSClient client = new WSClient(conn, handshake.getResourceDescriptor());
		clients.put(conn, client);
		// Send
		server.connect(client);
	}
	@Override
	public void onClose(WebSocket conn, int code, String reason, boolean remote) {
		// Get client
		WSClient client = clients.get(conn);
		// Send
		server.disconnect(client);
		// Remove client
		clients.remove(conn);
	}
	@Override
	public void onMessage(WebSocket conn, String message) {
		// Get client
		WSClient client = clients.get(conn);
		// Send
		server.message(client, message);
	}
	@Override
	public void onMessage(WebSocket conn, ByteBuffer message) {
		// Get data
		String data = new String(message.array());
		// Get client
		WSClient client = clients.get(conn);
		// Send
		server.message(client, data);
	}
	@Override
	public void onError(WebSocket conn, Exception ex) {
		ex.printStackTrace();
		if (conn != null) {
			System.err.println(conn);
		}
	}
	@Override
	public void onStart() {
		System.out.println("WebSocket server started: " + getAddress());
		setConnectionLostTimeout(0);
		setConnectionLostTimeout(100);
	}
	/**
	 * Checks to see if a specific port is available.
	 *
	 * @param port the port to check for availability
	 */
	public static boolean isPortAvailable(int port) {
		ServerSocket ss = null;
		DatagramSocket ds = null;
		try {
			ss = new ServerSocket(port);
			ss.setReuseAddress(true);
			ds = new DatagramSocket(port);
			ds.setReuseAddress(true);
			return true;
		} catch (IOException e) {
		} finally {
			if (ds != null) {
				ds.close();
			}
			if (ss != null) {
				try {
					ss.close();
				} catch (IOException e) {
					/* should not be thrown */
				}
			}
		}
		return false;
	}
	public static void waitForPort(int port) {
		int i = 1;
		System.out.print("[waiting for ws port to close]");
		while (true) {
			if (isPortAvailable(port)) {
				System.out.println("\r[waiting for ws port to close" + ".".repeat(i) + "port closed!]");
				return;
			}
			System.out.print("\r[waiting for ws port to close" + ".".repeat(i) + "]");
			i += 1;
			try {
				Thread.sleep(3000);
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
		}
	}
}