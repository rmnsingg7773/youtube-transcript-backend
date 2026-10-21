const express = require('express');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
app.use(cors());
app.use(express.json());

let youtube;

async function getYouTubeClient() {
  if (!youtube) {
    youtube = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
  }
  return youtube;
}

app.post('/api/transcript', async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'URL zaroori hai.' });
    }

    const videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (!videoIdMatch) {
      return res.status(400).json({ success: false, error: 'Amanaye YouTube URL.' });
    }
    const videoId = videoIdMatch[1];

    const yt = await getYouTubeClient();
    const info = await yt.getInfo(videoId);
    
    // Get transcript with safety fallback
    const transcriptData = await info.getTranscript().catch(() => null);

    if (!transcriptData || !transcriptData.transcript || !transcriptData.transcript.content) {
      return res.status(404).json({ success: false, error: 'Is video mein captions uplabdh nahi hain.' });
    }

    const segments = transcriptData.transcript.content.body.initial_segments;
    const formattedTranscript = segments.map((item) => {
      const startMs = Number(item.start_ms);
      const minutes = Math.floor(startMs / 1000 / 60);
      const seconds = Math.floor((startMs / 1000) % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      return {
        text: item.snippet.text,
        offset: startMs,
        timestamp,
      };
    });

    return res.json({
      success: true,
      data: formattedTranscript,
      fullText: formattedTranscript.map((t) => t.text).join(' '),
    });

  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({
      success: false,
      error: 'Transcript fetch karne mein dikkat aayi.',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});