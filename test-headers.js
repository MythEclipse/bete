import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "sk-test",
  baseURL: "https://9router.imrnes.team/v1",
  fetch: async (url, init) => {
    console.log("Headers passed by OpenAI:");
    const headers = new Headers(init.headers);
    for (const [k, v] of headers.entries()) {
      console.log(`  ${k}: ${v}`);
    }
    // abort early to avoid making the request
    throw new Error("aborted");
  }
});

openai.chat.completions.create({
  model: "test",
  messages: [{role: "user", content: "test"}]
}).catch(e => {
  if (e.message !== "aborted") console.error(e);
});
