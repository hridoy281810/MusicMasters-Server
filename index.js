const express = require('express');
const app = express()
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

const { MongoClient, ServerApiVersion } = require('mongodb');
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

    app.get('/users', async(req , res)=>{
        const result =await usersCollection.find().toArray()
       res.send(result)
     })


     app.post('/users', async(req,res)=>{
        const user = req.body;
        console.log(user)
        const query =  {email: user.email}
        const existingUser =  await usersCollection.findOne(query)
        if(existingUser){
          return res.send({message: 'user already exist'})
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
       })
    
    app.get('/classes', async(req,res)=>{
        const result =await classesCollection.find().toArray()
       res.send(result)
    })
    app.get('/classes/popular', async (req, res) =>{
        const result = await classesCollection .find({ category: 'popular' }).sort({ number_of_students: -1 }).limit(6).toArray();
        res.send(result)
    })
    app.get('/classes/student', async (req, res) =>{
        const result = await classesCollection .find().sort({ number_of_students: -1 }).limit(6).toArray();
        res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('Server is running now')
})

app.listen(port, ()=>{
    console.log(`Server is running on port: ${port}`)
})
