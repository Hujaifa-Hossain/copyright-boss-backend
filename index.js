const express = require("express");
const fileUpload = require('express-fileupload');
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hjhp0t5.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const userCollection = client.db("copyright-boss").collection("users");
    const videoCollection = client.db("copyright-boss").collection("videos");

    app.get("/", async (req, res) => {
      res.send("hello from Copyright Boss");
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };

      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });

      if (requesterAccount.role === "admin") {
        const filter = { email: email };

        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.post("/upload", async (req, res) => {
      const file = req.files.formdata;
      const result = await videoCollection.insertOne(file);
      res.send(result);
    })

    app.post("/videos", async (req, res) => {
      const video = req.body;
      const result = await videoCollection.insertOne(video);
      res.send(result);
    });

    app.get("/videos", async (req, res) => {
      const query = {};
      const cursor = videoCollection.find(query);
      const videos = await cursor.toArray();
      res.send(videos);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`PORT = ${PORT}`);
});
