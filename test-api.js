import fetch from 'node-fetch';

async function test() {
  try {
    const response = await fetch('https://api.quran.com/api/v4/chapters?language=en');
    const data = await response.json();
    console.log("type of data.chapters:", typeof data.chapters);
    if (!data.chapters) console.log("DATA:", data);
  } catch (e) {
    console.log("error", e);
  }
}
test();
