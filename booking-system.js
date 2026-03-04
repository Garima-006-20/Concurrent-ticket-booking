const express = require("express");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

const PORT = 3000;

const client = createClient({
  url: process.env.REDIS_URL
});

client.connect()
  .then(() => console.log("Connected to Redis"))
  .catch(err => console.error(err));

const TOTAL_SEATS = 100;

async function initializeSeats() {
  const exists = await client.exists("available_seats");
  if (!exists) {
    await client.set("available_seats", TOTAL_SEATS);
    console.log("Seats initialized to", TOTAL_SEATS);
  }
}
initializeSeats();

app.post("/api/book", async (req, res) => {
  try {
    const lock = await client.set("lock", "true", {
      NX: true,
      EX: 5
    });

    if (!lock) {
      return res.status(429).json({
        success: false,
        message: "Try again"
      });
    }

    let seats = await client.get("available_seats");
    seats = parseInt(seats);

    if (seats <= 0) {
      await client.del("lock");
      return res.status(400).json({
        success: false,
        message: "No seats available"
      });
    }

    seats -= 1;
    await client.set("available_seats", seats);

    const bookingId = Date.now();

    await client.del("lock");

    res.status(200).json({
      success: true,
      bookingId: bookingId,
      remaining: seats
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("node booking-system.js");
  console.log("Booking system running on port 3000");
});
