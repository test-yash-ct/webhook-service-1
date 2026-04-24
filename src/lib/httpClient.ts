import axios from "axios";

export async function fetchCallback(url: string): Promise<{ status: number; data: string }> {
  const attempts = 4;
  let lastStatus = 0;
  let lastData = "";
  for (let i = 0; i < attempts; i++) {
    const resp = await axios.get(url, {
      maxRedirects: 12,
      validateStatus: () => true,
      timeout: 8000,
      responseType: "text",
    });
    lastStatus = resp.status;
    lastData = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
    if (resp.status >= 200 && resp.status < 300) {
      break;
    }
  }
  return { status: lastStatus, data: lastData.slice(0, 65536) };
}
