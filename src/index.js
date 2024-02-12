const express = require('express')
const axios = require('axios')
const pasth = require("path")
const bcrypt = require("bcrypt")
const { User, DeletedUser, History } = require('./config');
require('dotenv').config();


const app = express()

//convert data into json format
app.use(express.json())
app.use(express.urlencoded({extended: false}))

//use ejs as the view engine
app.set('view engine', 'ejs')

//static file
app.use(express.static("public"))



app.get("/login", (req,res) =>{
    res.render("login")
})

app.get("/signup", (req,res) =>{
    res.render("signup")
})

app.get("/", (req,res)=>{
    res.render('home', {
        weatherImage: 'pictures/rain.png',
        apodImage: 'pictures/space.png',
        newsImage: 'pictures/news(1).png',
    });
})


//admin page
app.get('/admin', async (req, res) => {
    try {
        const users = await User.find()
        const deletedUsers = await DeletedUser.find()
        res.render('admin', { users, deletedUsers });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

//add new user
app.get('/admin/new', (req,res) =>{
    res.render("addNewUser")
})

//delete user
app.get('/admin/delete/:name', async (req, res) => {
    try {
        // Find the user by ID
        const userForDelete = await User.findOne({name: req.params.name});

        if (!userForDelete) {
            return res.status(404).send('User not found');
        }

        const deletedData = {
            name: req.params.name,
            createdDate: userForDelete.createdDate,
            deletionDate: new Date()
        }

        await DeletedUser.insertMany(deletedData)

        await User.deleteOne(userForDelete);

        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin/edit/:name', async (req, res) => {
    try {
        const user = await User.findOne({name: req.params.name});
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('editUser', { user }); // Assuming you have an 'editUser' EJS view
    } catch (err) {
        console.error("Error occurred:", err);
        res.status(500).send('Server error');
    }
});


// Handle the /weather route
app.get("/weather", async (req, res) => {
    // Get the city from the query parameters
    const city = req.query.city;
    const apiKey = process.env.OPEN_WEATHER_API_KEY;
    const data = {
        city: city,
        weather: "",
        temperature: ""
    }

    // Add your logic here to fetch weather data from the API
    const APIUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`;
    let weather;
    let error = null;
    try {
        const response = await axios.get(APIUrl);
        weather = response.data;
        data.weather = weather.weather[0].main
        data.temperature = weather.main.temp
        await History.insertMany(data)
    } catch  {
        weather = null;
        error = "Error, Please try again";
    }
    // Render the index template with the weather data and error message
    res.render("weather", { weather, error });
});

app.get('/history', async (req, res)=>{
    try {
        const histories = await History.find()

        res.render('history', { histories });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
})

app.get('/apod', async (req, res) => {
    const apiKey = process.env.APOD_API_KEY
    const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
    try {
        const response = await axios.get(url);
        res.render('apod', {  apodData: response.data });
    } catch (error) {
        res.render('apod', {  apodData: {} });
    }
});



app.get('/news', async (req, res) => {
    const apiKey = process.env.NEWS_API_KEY
    const url = `https://newsapi.org/v2/everything?q=cryptocurrency&apiKey=${apiKey}`
    try {
        const response = await axios.get(url);
        res.render('news', {  newsData: response.data });
    } catch (error) {
        res.render('news', {  newsData: {} });
    }
});


// Route to handle the edit form submission
app.post('/admin/edit/:name', async (req, res) => {
    try {
        // const { name, password, isAdmin } = req.body;
        let user = await User.findOne({name: req.params.name}); // search user
        if (!user) {
            return res.status(404).send('User not found');
        }
        if (req.params.name !== req.body.name){ // check the old and new username
            const existingUser = await User.findOne({name: req.body.name}) // check the new username
            if (existingUser) {
                return res.send("User already exists. Please choose another username.");
               // res.redirect('/admin/edit/:name')
            }
        }

        const isAdminBoolean = req.body.isAdmin === 'on' ? true : false;
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds)

        // Updating user details
        user.name = req.body.name;
        user.password = hashedPassword  // replace passwords // Consider encrypting the password
        user.updatedDate = new Date();
        user.isAdmin = isAdminBoolean;

        await user.save();
        res.redirect('/admin'); // Redirect to the dashboard or some other page

    } catch (err) {
        console.error("Error occurred:", err);
        res.status(500).send('Server error');
    }
});

//Register User
app.post("/signup", async (req,res)=>{
    const data = {
        name: req.body.username,
        password: req.body.password,
        createdDate: new Date(),
        updatedDate: new Date(),
        isAdmin: false
    }
    //check if the user already exists
    const existingUser = await User.findOne({name: data.name})
    if (existingUser){
        res.send("User already exists. Please choose another username.");
    }else{
        // hash the password by using bcrypt
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(data.password, saltRounds)
        data.password = hashedPassword  // replace passwords
        const userData = await User.insertMany(data)
        console.log(userData)
        // place to redirect a user to login page
        res.redirect("/login");
    }

})

app.post('/admin/new', async (req,res)=>{

    const data = {
        name: req.body.username,
        password: req.body.password,
        createdDate: new Date(),
        updatedDate: new Date(),
        isAdmin: false
    }
    //check if the user already exists
    const existingUser = await User.findOne({name: req.body.username})
    if (existingUser){
        return res.send("User already exists. Please choose another username.");
    }else{
        // hash the password by using bcrypt
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(data.password, saltRounds)
        data.password = hashedPassword  // replace passwords
        data.isAdmin = req.body.isAdmin === 'on' ? true : false;
        const userData = await User.insertMany(data)
        console.log(userData)
        // place to redirect a user to login page
        res.redirect("/admin");
    }

})

app.post("/login", async (req,res)=>{
    try {
        const check = await User.findOne({name: req.body.username})
        if(!check){
            res.send("Wrong username")
        }

        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password)
        if(isPasswordMatch){
            if (check.isAdmin){
                res.redirect('/admin')
            }else{
                res.redirect('/home')
            }

        }else{
            res.send("wrong password")
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.send("wrong Details")
    }
})

app.use((req, res, next) => {
    // res.status(404).send("Page Not Found");
    const ErrorCode = 404
    const ErrorMsg = "Page Not Found"
    res.render("error", {ErrorCode, ErrorMsg });
});

const port = 3000
app.listen(port, () =>{
    console.log(`Server running on Port: ${port}`)
})

