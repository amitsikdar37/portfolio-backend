require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const rateLimit = require('express-rate-limit')
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai')

// Load projects data for AI context
const projectsData = JSON.parse(fs.readFileSync('./projects.json', 'utf8'));

const app = express()
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

// Rate Limiter: 5 requests per day per IP
const chatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'You have reached the daily limit of 5 questions. Please come back tomorrow!' },
  standardHeaders: true,
  legacyHeaders: false,
})

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
    return response.data;
  } catch (error) {
    console.error("Telegram API Error:", error.response?.data || error.message);
    throw error;
  }
}

app.post('/api/contact', async (req, res) => {
  const { name, email, budget, message } = req.body

  const notificationText = `<b>New Portfolio Contact!</b>\n\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}\n<b>Budget:</b> ${budget}\n<b>Message:</b> ${message}`;

  try {
    await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID, notificationText);
    res.status(200).send('Message sent successfully');
  } catch (error) {
    res.status(500).send('Failed to send message');
  }
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const systemPrompt = `You are the personal AI assistant wrapper representing Amit on his portfolio website.
Amit is a second year undergraduate student at IIT Patna architecting the intersection of autonomous AI and high-end design.
His tech stack & skills: RAG-based agents, LLM integration, MERN stack (backend specialization), Python (scripting/AI foundation), and high-fidelity UI design in Figma (dark-mode aesthetic).
He also runs a YouTube channel documenting his tech journey and builds.

Here is a list of his built projects, complete with their tech stack and key features:
${JSON.stringify(projectsData, null, 2)}

Answer questions about Amit based on this context. Keep answers friendly, professional, engaging, and relatively concise. If a user asks something completely unrelated, politely redirect them back to topics about Amit's skills or projects.`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: systemPrompt
    });

    const response = await model.generateContent(message);
    const text = response.response.text();

    res.status(200).json({ response: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to fetch response from AI." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running On Port ${PORT}`));