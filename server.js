const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/transcript', async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'URL zaroori hai.' });
    }

    // Extract Video ID
    const videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (!videoIdMatch) {
      return res.status(400).json({ success: false, error: 'Amanaye YouTube URL.' });
    }
    const videoId = videoIdMatch[1];

    // Fetch video page directly with browser User-Agent
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      },
    });

    const html = await response.text();

    // Extract caption tracks from HTML
    const splitHtml = html.split('"captions":');
    if (splitHtml.length < 2) {
      return res.status(404).json({ success: false, error: 'Is video mein captions uplabdh nahi hain.' });
    }

    const captionJson = JSON.parse(splitHtml[1].split(',"videoDetails"')[0]);
    const captionTracks = captionJson?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(404).json({ success: false, error: 'Is video ke liye koi caption track nahi mila.' });
    }

    // Prefer Hindi or English track if available, else pick first track
    const track = captionTracks.find((t) => t.languageCode === 'hi') || 
                  captionTracks.find((t) => t.languageCode === 'en') || 
                  captionTracks[0];

    // Fetch transcript XML
    const xmlResponse = await fetch(track.baseUrl);
    const xmlText = await xmlResponse.text();

    // Parse XML
    const transcript = [];
    const regex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>(.*?)<\/text>/g;
    let match;

    while ((match = regex.exec(xmlText)) !== null) {
      const startSec = parseFloat(match[1]);
      const rawText = match[3];

      // Decode HTML entities
      const text = rawText
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      const minutes = Math.floor(startSec / 60);
      const seconds = Math.floor(startSec % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      transcript.push({
        text,
        timestamp,
        offset: startSec * 1000,
      });
    }

    if (transcript.length === 0) {
      return res.status(404).json({ success: false, error: 'Transcript khaali mili ya parse nahi ho saki.' });
    }

    return res.json({
      success: true,
      data: transcript,
      fullText: transcript.map((t) => t.text).join(' '),
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Transcript fetch karne mein dikkat aayi. Kripya dubara prayas karein.',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});