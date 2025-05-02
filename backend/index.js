const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri =
  "mongodb+srv://ranjanabhi2468:mExaWmq0pqSjptOU@doctors.58lxyp8.mongodb.net/?retryWrites=true&w=majority&appName=doctors";
const client = new MongoClient(uri);

let doctorsCollection;

async function connectToMongoDB() {
  try {
    await client.connect();
    const database = client.db("doctors_db");
    doctorsCollection = database.collection("doctors");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

connectToMongoDB();

// API to add a doctor
app.post("/api/doctors", async (req, res) => {
  const { name, specialty, experience, fees, languages, mode_of_consult, hospital, image } = req.body;
  try {
    const result = await doctorsCollection.insertOne({
      name,
      specialty,
      experience: parseInt(experience),
      fees: parseInt(fees),
      languages: Array.isArray(languages) ? languages : [languages], // Ensure languages is an array
      mode_of_consult: Array.isArray(mode_of_consult) ? mode_of_consult : [mode_of_consult], // Ensure mode_of_consult is an array
      hospital,
      image,
    });
    res.status(201).json({ id: result.insertedId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: "Failed to add doctor" });
  }
});

// API to list doctors with filters, sorting, and pagination
app.get("/api/doctors", async (req, res) => {
  const { mode_of_consult, experience, fees, language, facility, page = 1, limit = 10, sort } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build the query
  const query = {};

  // Handle multiple values for mode_of_consult
  if (mode_of_consult) {
    const modes = mode_of_consult.split(",");
    query.mode_of_consult = { $in: modes };
  }

  // Handle multiple experience ranges
  if (experience) {
    const ranges = experience.split(",");
    const experienceConditions = ranges.map((range) => {
      const [min, max] = range.split("-").map(Number);
      return { experience: { $gte: min, $lte: max || 100 } };
    });
    if (experienceConditions.length > 0) {
      query.$or = experienceConditions;
    }
  }

  // Handle multiple fees ranges
  if (fees) {
    const ranges = fees.split(",");
    const feesConditions = ranges.map((range) => {
      const [min, max] = range.split("-").map(Number);
      return { fees: { $gte: min, $lte: max || 10000 } };
    });
    if (feesConditions.length > 0) {
      if (query.$or) {
        query.$or = [...query.$or, ...feesConditions];
      } else {
        query.$or = feesConditions;
      }
    }
  }

  // Handle multiple languages
  if (language) {
    const languages = language.split(",");
    query.languages = { $in: languages.map((lang) => new RegExp(lang, "i")) };
  }

  // Handle multiple facilities
  if (facility) {
    const facilities = facility.split(",");
    const facilityConditions = [];
    if (facilities.includes("Apollo Hospital")) {
      facilityConditions.push({ hospital: { $regex: "apollo", $options: "i" } });
    }
    if (facilities.includes("Other Clinics")) {
      facilityConditions.push({ hospital: { $not: { $regex: "apollo", $options: "i" } } });
    }
    if (facilityConditions.length > 0) {
      if (query.$or) {
        query.$or = [...query.$or, ...facilityConditions];
      } else {
        query.$or = facilityConditions;
      }
    }
  }

  // Build sorting options
  let sortOption = {};
  switch (sort) {
    case "price-low-to-high":
      sortOption = { fees: 1 };
      break;
    case "price-high-to-low":
      sortOption = { fees: -1 };
      break;
    case "experience":
      sortOption = { experience: -1 };
      break;
    default:
      sortOption = {};
  }

  try {
    const doctors = await doctorsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await doctorsCollection.countDocuments(query);

    res.json({
      doctors,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});