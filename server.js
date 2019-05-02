var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongo = require('mongodb');

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

router.use(function(req, res, next){
    console.log('Something is happening');
    next();
});

router.get('/', function(req, res){
    res.json({ message: "Ura! Bun venit la api-ul nostru al aplicatiei BestNotes!" });
});

router.post('/users/register', function(req, res){
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
    if( item.firstName==="" ){
        res.json({ message: "Nu ati completat campul prenume" });
        return;
    }
    if( item.lastName==="" ){
        res.json({ message: "Nu ati completat campul nume" });
        return;
    }
    if( item.email==="" ){
        res.json({ message: "Nu ati completat campul email" });
        return;
    }
    if( item.userName==="" ){
        res.json({ message: "Nu ati completat campul nume de utilizator" });
        return;
    }
    if( item.password==="" ){
        res.json({ message: "Nu ati completat campul parola" });
        return;
    }
    if( item.passwordConfirmation==="" ){
        res.json({ message: "Nu ati completat campul comfirmare parola" });
        return;
    }
    if( item.phoneNumber==="" ){
        res.json({ message: "Nu ati completat campul numar de telefon" });
        return;
    }

    mongo.connect(url, { useNewUrlParser: true }, function(err, db){
        if( err )
            res.send(err);
        var dbo = db.db("mydb");
        Users=dbo.collection('user-data');
        Users.findOne({ email:item.email }, function(err, user){
            if(err)
                res.send(err);
            if(user){
                res.json({ message: "This email adress is already used" });
                db.close();
                return;
            }
            bcrypt.hash(item.password, saltRounds, function(err, hash){
                if(err)
                    res.send(err);
                item.password = hash;
                item.passwordConfirmation = hash;
                Users.insertOne(item, function(err, result){
                    if(err)
                        res.send(err);
                    res.json({ message: "Utilizator creat cu succes!" }); 

                    //!!! AICI CRIPTEZ email-ul pentru a crea confirmation token-ul
                    var activationToken = cryptoJS.AES.encrypt(item.email, KEY).toString();
                    console.log(activationToken);
                    activationToken = encodeURIComponent(activationToken);
                    var mailOptions = {
                        from: 'bestnotes16@gmail.com',
                        to: item.email,
                        subject: 'Activare cont BestNotes',
                        text: 'Dati click pe link-ul:http://localhost:8084/users/'+activationToken+' pentru a va activa contul pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat cont pe BestNotes va rugam sa ignorati mail-ul!'
                    };
                    transporter.sendMail(mailOptions, function(err, info){
                        if(err){
                            res.send(err);
                            console.log(err);
                            db.close();
                            return;
                        }
                        console.log('Email-ul de validare cont a fost trimis la adresa dumeneavoastra de mail'+info.response);
                        db.close();
                    });
                    /*console.log(activationToken);
                    activationToken = decodeURIComponent(activationToken);
                    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
                    console.log(decryptedToken.toString(cryptoJS.enc.Utf8));*/
                    
                });
            });
        });
    });
});

app.use('/',router);

app.listen(port);
console.log('Magin happens on port ' + port);
