const express = require('express');
const app = express()
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  // bearer token
  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6iur0l.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// require('crypto').randomBytes(64).toString('hex')
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('musicSchool').collection('users')
    const classesCollection = client.db('musicSchool').collection('classes')
    const selectedCollection = client.db('musicSchool').collection('selected')
    const feedbackCollection = client.db('musicSchool').collection('feedback')
    const paymentCollection = client.db('musicSchool').collection('payment')


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: '7d' })
      res.send(token)
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: "forbidden" })
      }
      next()
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: "forbidden" })
      }
      next()
    }

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // verify admin 
    app.get('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email
      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })
    // verify instructor 
    app.get('/users/instructor/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email
      if (req.decoded.email !== email) {
        return res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const result = { instructor: user?.role === 'instructor' }
      res.send(result)
    })

    //  post user data in database , one user data save one time, first create account   
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user)
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { role: 'admin' },
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { role: 'instructor' },
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })
// TODO:
    // all classes page api 
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find({status:'approve'}).toArray()
      res.send(result)
    })
    // TODO:
    // instructors page api 
    app.get('/instructors', async (req, res) => {
      const result = await classesCollection.aggregate([
        { $group: { _id: "$instructor_email", doc: { $first: "$$ROOT" } } },
        { $project: { _id: 0, email: "$_id", doc: 1 } }
      ]).toArray();

      res.send(result.map(({ doc }) => doc));
    });

    // instructors class posted only see instructor 
    app.get('/classes/instructor/:email', async (req, res) => {
      const email = req.params.email;
      const query = { instructor_email: email }
      const result = await classesCollection.find(query).toArray()
      res.send(result)
    })

    // admin only show all classe added by instructor get by role
    app.get('/classes/role', async (req, res) => {
      const result = await classesCollection.find({ role: 'instructor' }).toArray()
      res.send(result)
    })

    // only admin can change class status approve
    app.patch('/classes/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { status: 'approve' },
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    // only admin can change class status deny
    app.patch('/classes/deny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { status: 'deny' },
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    // /classes/student
    // home page api 
    app.get('/classes/student', async (req, res) => {
      const result = await classesCollection.find({status:'approve'}).sort({ number_of_students: -1 }).limit(6).toArray();
      res.send(result)
    })

    // app.get('/classes/popular', async (req, res) => {
    //   const {email} = req.body
      
    //   const result = await classesCollection.find({status:'approve',instructor_email: { $ne: email } }).sort({ number_of_students: -1 }).limit(6).toArray();
    //   res.send(result)
    // })
    // home page api 
    app.get('/classes/popular', async (req, res) => {
      const result = await classesCollection.aggregate([
        { $group: { _id: '$instructor_email', doc: { $first: '$$ROOT' } } },
        { $sort: { 'doc.number_of_students': -1 } },
        { $limit: 6 },
        { $sort: { 'doc.number_of_students': -1 } }
      ]).toArray();

      res.send(result.map(({ doc }) => doc));
    });
    // .sort({ number_of_students: -1 }).limit(6).
    // instructor add class api 
    app.post('/classes', async (req, res) => {
      const singleClass = req.body;
      const result = await classesCollection.insertOne(singleClass)
      res.send(result)

    })


    // admin feedback classes 

    app.post('/feedback', async (req, res) => {
      const feedback = req.body;
      const classId = feedback.classId;
      const classData = await classesCollection.findOne({ _id: new ObjectId(classId) });
      if (!classData) {
        return res.status(404).json({ error: 'Class not found' });
      }
      if (classData.status === 'pending' || classData.status === 'approve') {
        return res.status(400).json({ error: 'Feedback not allowed for this class' });
      }
      const updatedClassData = {
        ...classData,
        adminFeedback: feedback.feedback,
      };
      const result = await classesCollection.updateOne({ _id: new ObjectId(classId) }, { $set: updatedClassData });
      res.send(result);
    });

// =========

    app.get('/selected',verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([])
      }
      // const decodedEmail = req.decoded.email;
      // if(email !== decodedEmail){
      //   return res.status(401).send({error: true, message: 'forbidden access'})
      // }
      const query = { "student.email": email }
      const result = await selectedCollection.find(query).toArray()
      res.send(result)
    })

// =========
    app.post('/selected',verifyJWT, async (req, res) => {
      const select = req.body;
      const result = await selectedCollection.insertOne(select)
      res.send(result)
    })

    app.delete('/selected/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.json({ deletedCount: result.deletedCount });
    });

    app.get('/select/classes/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(query);
      res.json(result);
    });
    // payment process api for checkout page
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = Math.ceil(price * 100); // Convert price to cents and round up
      if (amount < 1) {
        return res.status(400).send({ error: true, message: 'Invalid amount' });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
        res.send({
          clientSecret: paymentIntent.client_secret
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: 'An error occurred while creating payment intent' });
      }
    });

    // payment info api  student
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment)

      const query = { _id: { $in: payment.payment_class_Id.map(id => new ObjectId(id)) } }
      const deleteResult = await selectedCollection.deleteOne(query)
      res.send({ result, deleteResult })
    })

    //
    app.get('/payments/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray()
      res.send(result)

    })

    // classes update student
    app.patch('/classes/:id', verifyJWT, async (req, res) => {
      const classes = req.body;
      console.log(classes)
      if (classes.available_seats < 0) {
        return res.status(400).send({ error: true, message: 'Invalid amount' });
      }
      const filter = { _id: new ObjectId(req.params.id) }

      const updatedDoc = {
        $set: { number_of_students: classes.number_of_students, available_seats: classes.available_seats }
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server is running now')
})

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`)
})
