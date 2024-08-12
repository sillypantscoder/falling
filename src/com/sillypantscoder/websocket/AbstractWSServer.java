package src.com.sillypantscoder.websocket;

public abstract class AbstractWSServer {
	public abstract void connect(WSClient client);
	public abstract void message(WSClient client, String message);
	public abstract void disconnect(WSClient client);
}
