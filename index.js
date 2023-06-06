const express = require('express');
const app = express()
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/',(req,res)=>{
    res.send('Server is running now')
})

app.listen(port, ()=>{
    console.log(`Server is running on port: ${port}`)
})
