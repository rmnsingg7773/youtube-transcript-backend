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

    let transcriptData;
    try {
      transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl);
    } catch (err) {
      // Agar direct URL fail ho jaye, toh Video ID nikal kar try karein
      const videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (videoIdMatch) {
        const videoId = videoIdMatch[1];
        transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
      } else {
        throw err;
      }
    }

    if (!transcriptData || transcriptData.length === 0) {
      return res.status(404).json({ success: false, error: 'Is video mein captions uplabdh nahi hain.' });
    }

    const formattedTranscript = transcriptData.map((item) => {
      const minutes = Math.floor(item.offset / 1000 / 60);
      const seconds = Math.floor((item.offset / 1000) % 60);
      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      return {
        text: item.text,
        duration: item.duration,
        offset: item.offset,
        timestamp: formattedTime,
      };
    });

    return res.json({
      success: true,
      data: formattedTranscript,
      fullText: transcriptData.map((t) => t.text).join(' '),
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({
      success: false,
      error: 'Transcript fetch karne mein dikkat aayi. Kripya doosra video try karein.',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});