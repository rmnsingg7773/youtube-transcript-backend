const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/transcript', async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'URL zaroori hai.' });
    }

    // YouTube URL से Video ID निकालें
    const videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (!videoIdMatch) {
      return res.status(400).json({ success: false, error: 'Amanaye YouTube URL।' });
    }
    const videoId = videoIdMatch[1];

    // Direct YouTube page fetch with headers to bypass blocks
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await watchRes.text();

    const captionMatch = html.match(/"captions":\s*({.+?}),"videoDetails"/);
    if (!captionMatch) {
      return res.status(404).json({ success: false, error: 'Is video mein captions uplabdh nahi hain.' });
    }

    const captionsJson = JSON.parse(captionMatch[1]);
    const captionTracks = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(404).json({ success: false, error: 'Koi caption track nahi mila.' });
    }

    const transcriptUrl = captionTracks[0].baseUrl;
    const transcriptRes = await fetch(transcriptUrl);
    const transcriptXml = await transcriptRes.text();

    const transcript = [];
    const textRegex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>(.*?)<\/text>/g;
    let match;

    while ((match = textRegex.exec(transcriptXml)) !== null) {
      const startSec = parseFloat(match[1]);
      const text = match[3]
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
      return res.status(500).json({ success: false, error: 'Transcript parse nahi ho payi.' });
    }

    return res.json({
      success: true,
      data: transcript,
      fullText: transcript.map((t) => t.text).join(' '),
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({
      success: false,
      error: 'YouTube ne request block kar di hai.',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});