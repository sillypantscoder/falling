package src.com.sillypantscoder.utils;

import java.util.ArrayList;
import java.util.HashMap;

public class JSON {
	public static class Buffer {
		public String data;
		public int pos;
		public Buffer(String data) {
			this.data = data;
			this.pos = 0;
		}
		public char read() {
			this.pos += 1;
			return this.data.charAt(pos - 1);
		}
		public char nextChar() {
			return this.data.charAt(pos);
		}
		public void consumeWhitespace() {
			while (this.pos < this.data.length() && Character.isWhitespace(this.data.charAt(this.pos))) {
				this.pos += 1;
			}
		}
		public void consume(char c) {
			if (this.data.charAt(this.pos) == c) {
				this.pos += 1;
			} else {
				throw new RuntimeException("Expected a '" + c + "' character");
			}
		}
		public String toString() {
			return this.data.replace("\n", "↲").replace("\t", "⇥") + "\n" + "-".repeat(this.pos) + "^";
		}
	}
	public static JValue readValue(Buffer data) {
		if (data.nextChar() == '{') return JObject.read(data);
		if (data.nextChar() == '[') return JList.read(data);
		if (data.nextChar() == '\"') return JString.read(data);
		if ("0123456789-".contains(String.valueOf(data.nextChar()))) return JNumber.read(data);
		if ("tf".contains(String.valueOf(data.nextChar()))) return JBoolean.read(data);
		if (data.nextChar() == 'n') return JNull.read(data);
		throw new RuntimeException("Unknown value");
	}
	public static abstract class JValue {
		public abstract String toString();
	}
	public static class JNull extends JValue {
		public JNull() {
		}
		public String toString() {
			return "null";
		}
		public static JNull read(Buffer b) {
			b.consume('n');
			b.consume('u');
			b.consume('l');
			b.consume('l');
			return new JNull();
		}
	}
	public static class JNumber extends JValue {
		public double n;
		public JNumber(double n) {
			this.n = n;
		}
		public String toString() {
			return "" + this.n;
		}
		public static JNumber read(Buffer b) {
			String data = "" + b.read();
			while (true) {
				char c = b.nextChar();
				if ("0123456789.".contains(String.valueOf(c))) {
					data += b.read();
				} else {
					return new JNumber(Double.parseDouble(data));
				}
			}
		}
	}
	public static class JBoolean extends JValue {
		public boolean b;
		public JBoolean(boolean b) {
			this.b = b;
		}
		public String toString() {
			return "" + this.b;
		}
		public static JBoolean read(Buffer b) {
			if (b.nextChar() == 't') {
				b.consume('t');
				b.consume('r');
				b.consume('u');
				b.consume('e');
				return new JBoolean(true);
			} else {
				b.consume('f');
				b.consume('a');
				b.consume('l');
				b.consume('s');
				b.consume('e');
				return new JBoolean(false);
			}
		}
	}
	public static class JString extends JValue {
		public String s;
		public JString(String s) {
			this.s = s;
		}
		public String toString() {
			return "\"" + this.s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
		}
		public static JString read(Buffer b) {
			b.consume('\"');
			String data = "";
			while (true) {
				char c = b.read();
				if (c == '\\') {
					char d = b.read();
					if (d == 'n') data += "\n";
					else if (d == '\\') data += "\\";
					else if (d == '"') data += "\"";
				} else if (c == '"') {
					return new JString(data);
				} else {
					data += c;
				}
			}
		}
	}
	public static class JList<T extends JValue> extends JValue {
		public ArrayList<T> items;
		public JList(ArrayList<T> items) {
			this.items = items;
		}
		public JList(T[] datas) {
			items = new ArrayList<T>();
			for (int i = 0; i < datas.length; i++) {
				items.add(datas[i]);
			}
		}
		public String toString() {
			String r = "[";
			for (int i = 0; i < items.size(); i++) {
				r += items.get(i).toString();
				if (i != items.size() - 1) {
					r += ", ";
				}
			}
			return r + "]";
		}
		@SuppressWarnings("unchecked")
		public<E extends JValue> JList<E> as(Class<E> type) {
			ArrayList<E> newItems = new ArrayList<E>();
			for (int i = 0; i < items.size(); i++) {
				T item = items.get(i);
				if (item.getClass() == type) {
					newItems.add((E)(item));
				}
			}
			return new JList<E>(newItems);
		}
		public static JList<? extends JValue> read(Buffer b) {
			b.consume('[');
			ArrayList<JValue> l = new ArrayList<JValue>();
			while (true) {
				b.consumeWhitespace();
				l.add(JSON.readValue(b));
				b.consumeWhitespace();
				if (b.nextChar() == ']') {
					b.read();
					break;
				}
				b.consume(',');
				b.consumeWhitespace();
			}
			ArrayList<? extends JValue> items = new ArrayList<JValue>(l);
			return new JList<>(items);
		}
	}
	public static class JObject<T extends JValue> extends JValue {
		public HashMap<String, T> items;
		public JObject(HashMap<String, T> items) {
			this.items = items;
		}
		public static<T extends JValue> JObject<T> create(String[] keys, T[] values) {
			HashMap<String, T> items = new HashMap<String, T>();
			for (int i = 0; i < keys.length; i++) {
				items.put(keys[i], values[i]);
			}
			return new JObject<T>(items);
		}
		public String toString() {
			String r = "{";
			ArrayList<String> keys = new ArrayList<String>(items.keySet());
			for (int i = 0; i < keys.size(); i++) {
				// Write key
				String key = keys.get(i);
				r += new JString(key).toString();
				r += ": ";
				// Write value
				T value = items.get(key);
				r += value.toString();
				if (i != items.size() - 1) {
					r += ", ";
				}
			}
			return r + "}";
		}
		public T get(String key) {
			if (items.containsKey(key)) {
				return items.get(key);
			} else {
				throw new RuntimeException("Missing key: " + key);
			}
		}
		@SuppressWarnings("unchecked")
		public<E> E get(String key, Class<E> type) {
			T item = get(key);
			if (item.getClass() == type) {
				return (E)(item);
			} else {
				throw new RuntimeException("Value is of the wrong type: " + key);
			}
		}
		@SuppressWarnings("unchecked")
		public<E extends JValue> JList<E> getList(String key, Class<E> listType) {
			JList<? extends JValue> item = get(key, JList.class);
			return item.as(listType);
		}
		public static JObject<? extends JValue> read(Buffer b) {
			b.consume('{');
			HashMap<String, JValue> l = new HashMap<String, JValue>();
			while (true) {
				b.consumeWhitespace();
				// Get key
				String key = JString.read(b).s;
				b.consumeWhitespace();
				b.consume(':');
				b.consumeWhitespace();
				// Get value
				JValue v = JSON.readValue(b);
				l.put(key, v);
				b.consumeWhitespace();
				// Next item
				if (b.nextChar() == '}') {
					b.read();
					break;
				}
				b.consume(',');
				b.consumeWhitespace();
			}
			HashMap<String, ? extends JValue> items = new HashMap<String, JValue>(l);
			return new JObject<>(items);
		}
	}
	// Helper functions
	public static JList<JNumber> makeIntList(int[] values) {
		JNumber[] items = new JNumber[values.length];
		for (int i = 0; i < values.length; i++) {
			items[i] = new JNumber(values[i]);
		}
		return new JList<JNumber>(items);
	}
	public static JList<JString> makeStringList(ArrayList<?> values) {
		JString[] items = new JString[values.size()];
		for (int i = 0; i < values.size(); i++) {
			items[i] = new JString(values.get(i).toString());
		}
		return new JList<JString>(items);
	}
	public static JList<JString> makeStringList(Object[] values) {
		JString[] items = new JString[values.length];
		for (int i = 0; i < values.length; i++) {
			items[i] = new JString(values[i].toString());
		}
		return new JList<JString>(items);
	}
}