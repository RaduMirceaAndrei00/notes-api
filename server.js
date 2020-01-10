var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var jwt = require('jsonwebtoken');
var cors = require('cors');

app.use(cors({origin: [/localhost/i]}));

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bestnotes16@gmail.com',
        pass: 'mirad28@yahoo.com'
    }
});

var bcrypt = require('bcrypt');
const saltRounds= 10; 

var cryptoJS = require('crypto-js');
var AES =  require('crypto-js/aes');
var SHA256 = require('crypto-js/sha256');

var url = 'mongodb://localhost:27017/db';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8084;

var router = express.Router();

const KEY = "5166546A576E5A72";

mongo.MongoClient.connect('mongodb://localhost:27017', {useNewUrlParser: true})
    .then(function (mongo) {
      return mongo.db('mydb');
    })
    .then(function (db) {
        Users = db.collection('user-data');
        Notes = db.collection('user-notes');
        Codes = db.collection('user-codes');
    });

var checkToken = function(req, res, next) {
    var header = req.headers['authorization'];
    if( typeof header!== 'undefined'){
        var bearer = header.split(' ');
        var token = bearer[1];
        req.token = token;
        next();
    }
    else{
        res.sendStatus(403);
    }
}

router.use(function(req, res, next){
    console.log('Something is happening');
    next();
});

router.get('/', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        return;
    }
    res.json({ 
        message: "Ura! Bun venit la api-ul nostru al aplicatiei BestNotes!", 
        autorizedData
    });   
});


router.post('/users/register', async function(req, res) {
    var item = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        userName: req.body.userName,
        password: req.body.password,
        passwordConfirmation: req.body.passwordConfirmation,
        phoneNumber: req.body.phoneNumber,
        active: false
    };
    /*if( item.password!==req.body.passwordConfirmation ){
        res.json({ message: "Parola din campul parola difera de cea din campul confirmare parola, va rog sa le introduceti din nou" });
        return;
    }*/
    if( item.password!==item.passwordConfirmation ){
        res.json({ message: "Parola din campul parola difera de cea din campul confirmare parola, va rog sa le introduceti din nou" });
        return;
    }
    if( !item.firstName ){
        res.json({ message: "Nu ati completat campul prenume" });
        return;
    }
    if( !item.lastName ){
        res.json({ message: "Nu ati completat campul nume" });
        return;
    }
    if( !item.email ){
        res.json({ message: "Nu ati completat campul email" });
        return;
    }
    if( !item.userName ){
        res.json({ message: "Nu ati completat campul nume de utilizator" });
        return;
    }
    if( !item.password ){
        res.json({ message: "Nu ati completat campul parola" });
        return;
    }
    if( !item.passwordConfirmation ){
        res.json({ message: "Nu ati completat campul comfirmare parola" });
        return;
    }
    if( !item.phoneNumber ){
        res.json({ message: "Nu ati completat campul numar de telefon" });
        return;
    }
    let user;
    // Aici caut daca exista deja un user cu acel mail
    try {
        user = await Users.findOne({ email:item.email });
    } catch(err){
        res.status(500).send(err);
        return;
    }
    if(user){
        res.json({ message: "Adresa de mail e deja folosita!" });
        return;
    } 
    //!!! AICI CRIPTEZ email-ul pentru a crea confirmation token-ul

    var activationToken = cryptoJS.AES.encrypt(item.email, KEY).toString();
    //console.log(activationToken);
    activationToken = encodeURIComponent(activationToken);
    /*console.log(activationToken);
    activationToken = decodeURIComponent(activationToken);
    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
    console.log(decryptedToken.toString(cryptoJS.enc.Utf8));*/
    var mailOptions = {
        from: 'bestnotes16@gmail.com',
        to: item.email,
        subject: 'Activare cont BestNotes',
        text: 'Dati click pe link-ul:http://localhost:4200/activate?code='+activationToken+' pentru a va activa contul pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat cont pe BestNotes va rugam sa ignorati mail-ul!'
    };
    codeItem = {code: activationToken};
    try {
        await Codes.insertOne(codeItem);
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await transporter.sendMail(mailOptions);
    } catch(err){
            res.status(500).send(err);
            console.log(err);
            return;
    }
        //res.json({ message: 'Email-ul de validare cont a fost trimis la adresa dumeneavoastra de mail' });
    let hash;
    try {
        hash = await bcrypt.hash(item.password, saltRounds);
    } catch(err){
        res.status(500).send(err);
        return;
    }
    item.password = hash;
    item.passwordConfirmation = hash;
    try {
        await Users.insertOne(item);
    } catch(err){
         res.status(500).send(err);
        return;
    }
    res.json({ message: "Utilizator creat cu succes! Aplicatia noastra va va trimite un mail de validare in cateva momente. Verificati mail-ul pentru a va activa contul, apoi puteti accesa link-ul de autentificare." });                    
});

router.get('/users/activation/:token', async function(req, res){
    var activationToken = req.params.token;
    var encryptedToken = encodeURIComponent(activationToken);
    activationToken = decodeURIComponent(activationToken);
    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
    decryptedToken = decryptedToken.toString(cryptoJS.enc.Utf8);
    let code;
    try{
        code = await Codes.findOne({code: encryptedToken});
        if(!code) {
            throw Error("Cod inexistent sau expirat");
        }                
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await Codes.deleteOne({code: encryptedToken});
                
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await Users.findOne({ email: decryptedToken });
    } catch(err){
        res.status(500).send(err);
        return;
    }
    try{
        await Users.updateOne({ email: decryptedToken }, { $set: { active: true } });
    } catch(err){
        res.status(500).send(err);
        return;
    }
});

router.post('/users/forgotPassword', async function(req, res) {
    var email = req.body.email;
    var activationToken = cryptoJS.AES.encrypt(email, KEY).toString();
    activationToken = encodeURIComponent(activationToken);
    var mailOptions = {
        from: 'bestnotes16@gmail.com',
        to: req.body.email,
        subject: 'Resetare parola',
        text: 'Dati click pe link-ul:http://localhost:4200/changePassword?code='+activationToken+' pentru a va reseta parola contului de pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat resetarea parolei va rugam sa ignorati mail-ul!'
    };
    let user;
    try {
        user = await Users.findOne({ email: email });
    } catch(err) {
            res.status(500).send(err);
            return;
    }
    if(!user){
        //res.json({ message: 'Utilizator neinregistrat' });
        //throw new Error("Utilizator neinregistrat");
        res.status(500).send('Utilizator neinregistrat!');
        return;
    }
    item = {code: activationToken};
    try {
        await Codes.insertOne(item);
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await transporter.sendMail(mailOptions);
    } catch(err){
            res.send(err);
            console.log(err);
            return;
    }
    res.json({ message: "Un email a fost trimis la adresa dumeavoastra" });
});
router.put('/users/forgotPassword/:token', async function(req, res) {
    var activationToken = req.params.token;
    var encryptedToken = encodeURIComponent(activationToken);
    activationToken = decodeURIComponent(activationToken);
    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
    decryptedToken = decryptedToken.toString(cryptoJS.enc.Utf8);
    var password = req.body.password;
    var passwordConfirmation = req.body.passwordConfirmation;
    try{
        code = await Codes.findOne({code: encryptedToken});
        if(!code) {
            throw Error("Cod inexistent sau expirat");
        }          
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await Codes.deleteOne({code: encryptedToken});
                
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try{
        await Users.findOne({ email: decryptedToken });
    } catch(err){
        res.status(500).send(err);
        return;
    }
    if( password!==passwordConfirmation ){
        res.json({ message: "Parola din campul parola difera de cea din campul confirmare parola, va rog sa le introduceti din nou" });
        return;
    }
    if( password==="" ){
        res.json({ message: "Nu ati completat campul parola" });
        return;
    }
    let hash;
    try {
        hash = await bcrypt.hash(password, saltRounds);
    } catch(err){
        res.status(500).send(err);
        return;
    }
    password = hash;
    passwordConfirmation = hash;
    try {
        await Users.updateOne({ email: decryptedToken }, { $set: { password: password, passwordConfirmation: passwordConfirmation, active: true } });
    } catch(err){
        res.status(500).send(err);
        return;
    }
    res.json({ message: "Parola a fost updatata" });
});

router.post('/users/login', async function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    let user;
    console.log(req.body);
    try {
        user = await Users.findOne({ email: email });
    } catch(err) {
            res.status(500).send(err);
            return;
    }
    if(!user){
        //res.json({ message: 'Utilizator neinregistrat' });
        //throw new Error("Utilizator neinregistrat");
        res.status(500).send('Utilizator neinregistrat!');
        return;
    }
    if(user.active == false){
        var activationToken = cryptoJS.AES.encrypt(email, KEY).toString();
        activationToken = encodeURIComponent(activationToken);
        var mailOptions = {
            from: 'bestnotes16@gmail.com',
            to: email,
            subject: 'Activare cont BestNotes',
            text: 'Dati click pe link-ul:http://localhost:4200/activate?code='+activationToken+' pentru a va activa contul pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat cont pe BestNotes va rugam sa ignorati mail-ul!'
        };
        codeItem = {code: activationToken};
        try {
            await Codes.insertOne(codeItem);
        } catch(err) {
            res.status(500).send(err);
            return;
        }       
        try {
            await transporter.sendMail(mailOptions);
        } catch(err){
            res.status(500).send(err);
            console.log(err);
            return;
        }
        res.status(500).send('Trebuie mai intai sa-ti activezi contul prin mail. Un email a fost trimis la adresa ta');
        return;
    }
    let result;
    try {
        result = await bcrypt.compare(password, user.password);
    } catch(err){
        res.status(500).send(err);
        return;
    }
    if(!result){
        res.status(500).send('Parola incorecta');
        return;
    }
    var JWTToken = jwt.sign({
        email: email,
        _id: user._id
    },
    KEY,
    {
        expiresIn: '2h'
    });
    res.json({
        message: 'Te-ai autentificat cu succes',
        token: JWTToken
    });
    console.log('Bravo!');
});

router.put('/users/changePassword', checkToken, async function(req, res){
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    if(req.body.password !== req.body.passwordConfirmation){
        res.json({ message: 'Parola din campul parola difera de cea din campul confirmare parola' });
        return;
    }
    if(!req.body.password){
        res.json({ message: 'Nu ai introdus nicio parola' });
        return;
    }
    let hash;
    try {
        hash = await bcrypt.hash(req.body.password, saltRounds);
    } catch(err){
        res.status(500).send(err);
        return;
    }
    var password = hash;
    var passwordConfirmation = hash;
    try {
        await Users.updateOne({ email: autorizedData.email }, { $set: { password: password, passwordConfirmation: passwordConfirmation, active: true } });
    } catch(err) {
        res.status(500).send(err);
    }
    res.json({ message: 'Parola a fost scimbata cu succes' });
});

router.put('/users/editAccount', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err) {
        res.status(500).send(err);
        return;
    }
    try {
        await Users.updateOne({ email: autorizedData.email }, { $set: { firstName: req.body.firstName, lastName: req.body.lastName, userName: req.body.userName, phoneNumber: req.body.phoneNumber } });
    } catch(err) {
        res.send(err);
    }
    res.json({ message: 'Contul a fost editat cu succes' });
});

router.get('/notes', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        return;
    }
    let notes;
    try {
    notes = await Notes.find({ email: autorizedData.email}).sort({_id: -1}).toArray();
    } catch(err) {
        res.send(err);
        return;
    }
    res.json(notes);
});

router.post('/notes', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        console.log('jwt nu functioneaza');
        return;
    }
    var item = {
        title: req.body.title,
        text: req.body.text,
        email: autorizedData.email  
    };
    if(!item.title){
        console.log("Nu ai compeltat campul titlu");
        console.log(req.body.title);
        res.status(500).send("Nu ai compeltat campul titlu");
        return;
    }
    if(!item.text){
        console.log("Nu ai compeltat campul text");
        res.status(500).send("Nu ai compeltat campul text");
        return;
    }
    try {
        await Notes.insertOne(item);
    } catch(err){
        res.status(500).send(err);
        return;
    }
    res.json({
        _id: item._id,
        title: item.title, 
        text: item.text,
        email: item.email
    });
});
router.get('/notes/:notes_id', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        return;
    }
    var id = mongo.ObjectId(req.params.notes_id);
    let note;
    try {
        note = await Notes.findOne({ _id:  id});
    } catch(err) {
        res.send(err);
        return;
    }
    if(!note){
        res.json({ message: "Nota inexistenta" });
        return;
    }
    if(note.email !== autorizedData.email){
        res.json({ message: 'Nu aveti dreptul la aceasta notita' });
        return;
    }
    res.json(note);
});

router.put('/notes/:notes_id', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        return;
    }
    var id = mongo.ObjectId(req.params.notes_id);
    let note;
    try {
        note = await Notes.findOne({ _id:  id});
    } catch(err) {
        res.send(err);
        return;
    }
    if(!note){
        res.json({ message: "Nota inexistenta" });
        return;
    }
    if(note.email !== autorizedData.email){
        res.json({ message: 'Nu aveti dreptul la aceasta notita' });
        return;
    }
    try {
        await Notes.updateOne({ _id: id }, { $set: { text: req.body.text, title: req.body.title } });
    } catch(err) {
        res.send(err);
        return;
    }
    res.json('Nota updatata cu succes');
});

router.delete('/notes/:notes_id', checkToken, async function(req, res) {
    let autorizedData;
    try {
        autorizedData = await jwt.verify(req.token, KEY);
    } catch(err){
        res.send(err);
        return;
    }
    var id = mongo.ObjectId(req.params.notes_id);
    let note;
    try {
        note = await Notes.findOne({ _id:  id});
    } catch(err) {
        res.send(err);
        return;
    }
    if(!note){
        res.json({ message: "Nota inexistenta" });
        return;
    }
    if(note.email !== autorizedData.email){
        res.json({ message: 'Nu aveti dreptul la aceasta notita' });
        return;
    }
    try {
        await Notes.deleteOne({ _id: id });
    } catch(err) {
        res.send(err);
        return;
    }
    res.json('Nota stearsa cu succes');
});

app.use('/',router);

app.listen(port);
console.log('Magin happens on port ' + port);