package src.com.sillypantscoder.utils;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.ArrayList;

public class Utils {
	public static<T> void log(T item) {
		System.out.println(getLog(item));
	}
	public static<T> String getLog(T item) {
		if (item instanceof String) return "\"" + item + "\"";
		else if (item instanceof Number) return "{" + item + "}";
		else if (item instanceof Object[] itemList) return logArray(itemList);
		else {
			String s = item.toString();
			return getLog(s);
		}
	}
	public static<T> String logArray(T[] items) {
		String result = "[";
		String[] strItems = new String[items.length];
		for (var i = 0; i < items.length; i++) strItems[i] = items[i].toString();
		for (var i = 0; i < strItems.length; i++) {
			if (i != 0) {
				result += ", ";
			}
			result += getLog(strItems[i]);
		}
		result += "]";
		return result;
	}
	public static String readFile(String name) {
		try {
			File f = new File(name);
			byte[] bytes = new byte[(int)(f.length())];
			FileInputStream fis = new FileInputStream(f);
			fis.read(bytes);
			fis.close();
			return new String(bytes);
		} catch (IOException e) {
			e.printStackTrace();
			return "";
		}
	}
	public static String decodeURIComponent(String in) {
		try {
			return URLDecoder.decode(in, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
			return in;
		}
	}
	public static String humanJoinList(ArrayList<String> list) {
		if (list.size() == 2) return list.get(0) + " and " + list.get(1);
		String result = "";
		for (int i = 0; i < list.size(); i++) {
			if (i == list.size() - 1) result += ", and ";
			else if (i == 0) result += "";
			else result += ", ";
			result += list.get(i);
		}
		return result;
	}
}
