const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const store_id = process.env.STOREDID;
const store_passwd = process.env.STOREDPASS;
const is_live = false;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.9nztkwc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const unauthorizedMessage = { status: 401, message: "unauthorized Access" };
const forbidenMessage = { status: 403, message: "forbiden Access" };

const jwtVerify = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jwt.verify(token, process.env.ACCESS_KEY, (err, decoded) => {
      if (err) {
        res.status(401).send(unauthorizedMessage);
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    res.status(401).send(unauthorizedMessage);
  }
};

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const userListCollection = client.db("burgLyf").collection("userList");
    const itemListCollection = client.db("burgLyf").collection("itemList");
    const cartListCollection = client.db("burgLyf").collection("cartList");
    const orderListCollection = client.db("burgLyf").collection("orderList");

    app.post("/jwt", (req, res) => {
      const data = req.body;
      const token = jwt.sign(data, process.env.ACCESS_KEY, { expiresIn: "1d" });
      res.send({ token });
    });

    // Role
    app.get("/role", async (req, res) => {
      const result = await userListCollection.findOne({
        userUID: { $eq: req.query.uid },
      });
      if (result) {
        res.send(result);
      }
    });
    //  cart Item Delete
    app.delete("/cartItemDelete/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      if (req.decoded.uid === req.query.uid) {
        const result = await cartListCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });
    // cart
    app.get("/cart", jwtVerify, async (req, res) => {
      if (req.decoded.uid === req.query.uid) {
        const result = await cartListCollection
          .find({
            uid: { $eq: req.query.uid },
          })
          .toArray();
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.post("/cart", jwtVerify, async (req, res) => {
      const data = req.body;
      if (req.decoded.uid === req.query.uid) {
        const result = await cartListCollection.insertOne(data);
        res.send(result);
      } else {
        res.send({ message: true });
      }
    });

    // users
    app.get("/users", jwtVerify, async (req, res) => {
      if (req.decoded.uid === req.query.uid) {
        const result = await userListCollection.find().toArray();
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.get("/singleUsers", jwtVerify, async (req, res) => {
      const result = await userListCollection.findOne({
        userUID: { $eq: req.query.uid },
      });
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const data = req.body;
      const isExit = await userListCollection.findOne({
        userEmail: { $eq: req.body.userEmail },
      });
      if (!isExit) {
        const result = await userListCollection.insertOne(data);
        res.send(result);
      } else {
        res.send({ message: true });
      }
    });

    app.patch("/users/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: data,
      };
      if (req.decoded.uid === req.query.uid) {
        const result = await userListCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.delete("/users/:id", jwtVerify, async (req, res) => {
      const data = req.params.id;
      const query = { _id: new ObjectId(data) };
      if (req.decoded.uid === req.query.uid) {
        admin
          .auth()
          .deleteUser(req.query.fid)
          .then(async () => {
            const result = await userListCollection.deleteOne(query);
            res.send(result);
          });
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    // product item
    app.get("/allItems", async (req, res) => {
      const limit = req.query.limit === "true" ? 8 : 0;
      const result = await itemListCollection
        .find({
          category: { $eq: req.query.category },
        })
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/item", jwtVerify, async (req, res) => {
      if (req.decoded.uid === req.query.uid) {
        const result = await itemListCollection.find().toArray();
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.get("/singleItem/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      if (req.decoded.uid === req.query.uid) {
        const result = await itemListCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.patch("/singleItem/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: data,
      };
      if (req.decoded.uid === req.query.uid) {
        const result = await itemListCollection.updateOne(query, updateDoc);
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    // itemDetails
    app.get("/itemDetails/:id", async (req, res) => {
      const id = req.params.id;
      const result = await itemListCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.post("/item", jwtVerify, async (req, res) => {
      const data = req.body;
      if (req.decoded.uid === req.query.uid) {
        const result = await itemListCollection.insertOne(data);
        res.send(result);
      } else {
        res.send({ message: true });
      }
    });

    app.delete("/item/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      if (req.decoded.uid === req.query.uid) {
        const result = await itemListCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });
    //  order
    app.delete("/orderDelete/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      if (req.decoded.uid === req.query.uid) {
        const result = await orderListCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.patch("/orderUpdate/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: true },
      };
      if (req.decoded.uid === req.query.uid) {
        const result = await orderListCollection.updateOne(query, updateDoc);
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.get("/userOrders", jwtVerify, async (req, res) => {
      if (req.decoded.uid === req.query.uid) {
        const result = await orderListCollection
          .find({
            userId: { $eq: req.query.uid },
          })
          .toArray();
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.delete("/userOrderItem/:id", jwtVerify, async (req, res) => {
      const id = req.params.id;
      if (req.decoded.uid === req.query.uid) {
        const result = await orderListCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    app.get("/adminOrders", jwtVerify, async (req, res) => {
      if (req.decoded.uid === req.query.uid) {
        const result = await orderListCollection.find().toArray();
        res.send(result);
      } else {
        res.status(403).send(forbidenMessage);
      }
    });

    // create Payment Intent
    app.post("/createPaymentIntent", jwtVerify, async (req, res) => {
      const transId = "BurgLYF_" + Math.round(Math.random() * 10000000000);
      const body = req.body;
      if (req.decoded.uid === req.query.uid) {
        const data = {
          total_amount: body.totalPrice,
          currency: "BDT",
          tran_id: transId, // use unique tran_id for each api call
          success_url: `https://burgry-server.vercel.app/paymentSuccess/${transId}?uid=${body.userId}`,
          fail_url: "https://burgry-server.vercel.app/cancel-payment",
          cancel_url: "https://burgry-server.vercel.app/cancel-payment",
          ipn_url: "https://burgry-server.vercel.app/ipn",
          shipping_method: "Courier",
          product_name: "Computer.",
          product_category: "Electronic",
          product_profile: "general",
          cus_name: "Customer Name",
          cus_email: "customer@example.com",
          cus_add1: "Dhaka",
          cus_add2: "Dhaka",
          cus_city: "Dhaka",
          cus_state: "Dhaka",
          cus_postcode: "1000",
          cus_country: "Bangladesh",
          cus_phone: "01711111111",
          cus_fax: "01711111111",
          ship_name: "Customer Name",
          ship_add1: "Dhaka",
          ship_add2: "Dhaka",
          ship_city: "Dhaka",
          ship_state: "Dhaka",
          ship_postcode: 1000,
          ship_country: "Bangladesh",
        };
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        sslcz.init(data).then((apiResponse) => {
          let GatewayPageURL = apiResponse.GatewayPageURL;
          res.send({ url: GatewayPageURL });
        });

        await orderListCollection.insertOne({
          ...body,
          transId,
          status: false,
          paymentStatus: false,
        });
      }
    });

    app.post("/paymentSuccess/:id", async (req, res) => {
      const result = await cartListCollection
        .find({
          uid: { $eq: req.query.uid },
        })
        .toArray();

      const findOrder = await orderListCollection.findOne({
        transId: { $eq: req.params.id },
      });

      await orderListCollection.updateOne(
        { _id: new ObjectId(findOrder._id) },
        {
          $set: {
            paymentStatus: true,
          },
        }
      );
      for (const element of findOrder.cartItem) {
        await itemListCollection.updateOne(
          {
            _id: new ObjectId(element.itemID),
          },
          {
            $inc: {
              quantity: -1,
            },
          }
        );
      }

      await cartListCollection.deleteMany({
        _id: { $in: result.map((e) => new ObjectId(e._id)) },
      });
      res.redirect(`https://burglyf.web.app/paymentSuccess/${req.params.id}`);
    });

    app.post("/cancel-payment", (req, res) => {
      res.redirect(`https://burglyf.web.app/customerDashboard/cart`);
    });

    // Connect the client to the server	(optional starting in v4.7)

    // Send a ping to confirm a successful connection
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BURGLYF is running");
});

app.listen(port, () => {
  console.log(`server is running on :${port}`);
});
