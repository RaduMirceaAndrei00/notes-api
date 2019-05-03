var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var jwt = require('jsonwebtoken');

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

router.get('/', checkToken, function(req, res){
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        res.json({ 
            message: "Ura! Bun venit la api-ul nostru al aplicatiei BestNotes!", 
            autorizedData
        });
    });
    
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
                text: 'Dati click pe link-ul:http://localhost:8084/users/activation/'+activationToken+' pentru a va activa contul pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat cont pe BestNotes va rugam sa ignorati mail-ul!'
            };
            transporter.sendMail(mailOptions, function(err, info){
                if(err){
                    res.send(err);
                    console.log(err);
                    db.close();
                    return;
                }
                res.json({ message: 'Email-ul de validare cont a fost trimis la adresa dumeneavoastra de mail' });
                bcrypt.hash(item.password, saltRounds, function(err, hash){
                    if(err)
                        res.send(err);
                    item.password = hash;
                    item.passwordConfirmation = hash;
                    Users.insertOne(item, function(err, result){
                        if(err)
                            res.send(err);
                        res.json({ message: "Utilizator creat cu succes!" });
                        db.close();
                    });
                });
            });
        });
    });
});
router.get('/users/activation/:token', function(req, res){
    var activationToken = req.params.token;
    activationToken = decodeURIComponent(activationToken);
    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
    decryptedToken = decryptedToken.toString(cryptoJS.enc.Utf8);
    mongo.connect(url, { useNewUrlParser: true }, function(err, db){
        if(err){
            res.send(err);
            db.close();
            return;
        }
        var dbo = db.db("mydb");
        dbo.collection('user-data').updateOne({ email: decryptedToken }, { $set: { active: true } }, function(err, user){
            if(err){
                res.send(err);
                db.close();
                return;
            }
            res.json({ message: "Contul utilizatorului cu mail-ul "+decryptedToken+" a fost activat" });
            db.close();
        });
    });
});
router.get('/users/forgotPassword', function(req, res) {
    var activationToken = cryptoJS.AES.encrypt(req.body.email, KEY).toString();
    activationToken = encodeURIComponent(activationToken);
    var mailOptions = {
        from: 'bestnotes16@gmail.com',
        to: req.body.email,
        subject: 'Resetare parola',
        text: 'Dati click pe link-ul:http://localhost:8084/users/forgotPassword/'+activationToken+' pentru a va reseta parola contului de pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat resetarea parolei va rugam sa ignorati mail-ul!'
    };
    transporter.sendMail(mailOptions, function(err, info){
        if(err){
            res.send(err);
            console.log(err);
            return;
        }
        res.json({ message: "Un email a fost trimis la adresa dumeavoastra" });
    });
});
router.put('/users/forgotPassword/:token', function(req, res) {
    var activationToken = req.params.token;
    activationToken = decodeURIComponent(activationToken);
    var decryptedToken = cryptoJS.AES.decrypt(activationToken, KEY);
    decryptedToken = decryptedToken.toString(cryptoJS.enc.Utf8);
    var password = req.body.password;
    var passwordConfirmation = req.body.passwordConfirmation;
    if( password!==passwordConfirmation ){
        res.json({ message: "Parola din campul parola difera de cea din campul confirmare parola, va rog sa le introduceti din nou" });
        return;
    }
    if( password==="" ){
        res.json({ message: "Nu ati completat campul parola" });
        return;
    }
    bcrypt.hash(password, saltRounds, function(err, hash){
        if(err){
            res.send(err);
            return;
        }
        password = hash;
        passwordConfirmation = hash;
        mongo.connect(url, { useNewUrlParser: true }, function(err, db){
            if(err){
                res.send(err);
                db.close();
                return;
            }
            var dbo = db.db("mydb");
            dbo.collection('user-data').updateOne({ email: decryptedToken }, { $set: { password: password, passwordConfirmation: passwordConfirmation, active: true } }, function(err, user){
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                res.json({ message: "Parola a fost updatata" });
                db.close();
            });
        });
    });
});

router.post('/users/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("mydb");
        dbo.collection("user-data").findOne({ email: email }, function(err, user) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            if(!user){
                res.json({ message: 'Utilizator neinregistrat' });
                db.close();
                return;
            }
            if(user.active == false){
                res.send({ message: 'Trebuie mai intai sa-ti activezi contul prin mail. Un email a fost trimis la adresa ta'});
                var activationToken = cryptoJS.AES.encrypt(email, KEY).toString();
                activationToken = encodeURIComponent(activationToken);
                var mailOptions = {
                    from: 'bestnotes16@gmail.com',
                    to: email,
                    subject: 'Activare cont BestNotes',
                    text: 'Dati click pe link-ul:http://localhost:8084/users/activation/'+activationToken+' pentru a va activa contul pe aplicatia BestNotes. Daca nu dumneavoastra ati solicitat cont pe BestNotes va rugam sa ignorati mail-ul!'
                };
                transporter.sendMail(mailOptions, function(err, info){
                    if(err){
                        res.send(err);
                        console.log(err);
                        return;
                    }
                    res.json({ message: "Un email a fost trimis la adresa dumeavoastra" });
                });
                db.close();
                return;
            }
            bcrypt.compare(password, user.password, function(err, result) {
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                if(!result){
                    res.json({ message: 'Parola incorecta!' });
                    db.close();
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
                db.close();
            });
        });
    }); 
});

router.put('/users/changePassword', checkToken, function(req, res){
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        if(req.body.password!==req.body.passwordConfirmation){
            res.json({ message: 'Parola din campul parola difera de cea din campul confirmare parola' });
            return;
        }
        if(!req.body.password){
            res.json({ message: 'Nu ai introdus nicio parola' });
            return;
        }
        bcrypt.hash(req.body.password, saltRounds, function(err, hash){
            if(err){
                res.send(err);
                return;
            }
            var password = hash;
            var passwordConfirmation = hash;
            mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                dbo=db.db("mydb");
                dbo.collection('user-data').updateOne({ email: autorizedData.email }, { $set: { password: password, passwordConfirmation: passwordConfirmation, active: true } }, function(err, user){
                    if(err)
                        res.send(err);
                    else
                        res.json({ message: 'Parola a fost scimbata cu succes' });
                    db.close();
                });
            });
        });
    });
    
});

router.put('/users/editAccount', checkToken, function(req, res){
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            dbo=db.db("mydb");
            dbo.collection('user-data').updateOne({ email: autorizedData.email }, { $set: { firstName: req.body.firstName, lastName: req.body.lastName, userName: req.body.userName, phoneNumber: req.body.phoneNumber } }, function(err, user){
                if(err)
                    res.send(err);
                else
                    res.json({ message: 'Contul a fost editat cu succes' });
                db.close();
            });
        });
    });
    
});

router.get('/notes', checkToken, function(req, res) {
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            dbo=db.db("mydb");
            dbo.collection('user-notes').find({ email: autorizedData.email}).toArray(function(err, notes){
                if(err)
                    res.send(err);
                else
                    res.json(notes);
                db.close();
            });
        });
    });
});
router.post('/notes', checkToken, function(req, res) {
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        var item = {
            title: req.body.title,
            text: req.body.text,
            email: autorizedData.email  
        };
        if(!item.title){
            res.json({ message: "Nu ai compeltat campul titlu" });
            return;
        }
        if(!item.text){
            res.json({ message: "Nu ai compeltat campul text" });
            return;
        }
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            dbo=db.db("mydb");
            dbo.collection('user-notes').insertOne(item, function(err, result){
                if(err)
                    res.send(err);
                else
                    res.json({ message: "Notita creata cu succes!" });
                db.close();
            });
        });
    });
});
router.get('/notes/:notes_id', checkToken, function(req, res) {
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            var dbo=db.db("mydb");
            var id = mongo.ObjectId(req.params.notes_id);
            dbo.collection('user-notes').findOne({ _id:  id}, function(err, note) {
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                if(!note){
                    res.json({ message: "Nota inexistenta" });
                    db.close();
                    return;
                }
                if(note.email!==autorizedData.email){
                    res.json({ message: 'Nu aveti dreptul la aceasta notita' });
                    db.close();
                    return;
                }
                dbo.collection('user-notes').find({ _id: id }).toArray(function(err, notes){
                    if(err)
                        res.send(err);
                    else
                        res.json(notes);
                    db.close();
                });
            });
        });
    });
});
router.put('/notes/:notes_id', checkToken, function(req, res) {
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            var dbo=db.db("mydb");
            var id = mongo.ObjectId(req.params.notes_id);
            dbo.collection('user-notes').findOne({ _id: id }, function(err, note){
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                if(!note){
                    res.json({ message: "Nota inexistenta" });
                    db.close();
                    return;
                }
                if(note.email!==autorizedData.email){
                    res.json({ message: 'Nu aveti dreptul la aceasta notita' });
                    db.close();
                    return;
                }
                dbo.collection('user-notes').updateOne({ _id: id }, { $set: { text: req.body.text, title: req.body.title } }, function(err, note){
                    if(err)
                        res.send(err);
                    else
                        res.json('Nota updatata cu succes');
                    db.close();
                });
            });
        });
    });
});
router.delete('/notes/:notes_id', checkToken, function(req, res) {
    jwt.verify(req.token, KEY, function(err, autorizedData) {
        if(err){
            res.send(err);
            return;
        }
        mongo.connect(url, { useNewUrlParser: true }, function(err, db) {
            if(err){
                res.send(err);
                db.close();
                return;
            }
            var dbo=db.db("mydb");
            var id = mongo.ObjectId(req.params.notes_id);
            dbo.collection('user-notes').findOne({ _id: id }, function(err, note){
                if(err){
                    res.send(err);
                    db.close();
                    return;
                }
                if(!note){
                    res.json({ message: "Nota inexistenta" });
                    db.close();
                    return;
                }
                if(note.email!==autorizedData.email){
                    res.json({ message: 'Nu aveti dreptul la aceasta notita' });
                    db.close();
                    return;
                }
                dbo.collection('user-notes').deleteOne({ _id: id }, function(err, note){
                    if(err)
                        res.send(err);
                    else
                        res.json('Nota stearsa cu succes');
                    db.close();
                });
            });
        });
    });
});

app.use('/',router);

app.listen(port);
console.log('Magin happens on port ' + port);
