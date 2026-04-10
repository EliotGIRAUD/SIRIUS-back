const userService = require('../services/userService');
const { signToken } = require('../config/jwt');

async function login(req, res) {
  try {
    const emailRaw = req.body && req.body.email;
    const passwordRaw = req.body && req.body.password;
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
    const password = typeof passwordRaw === 'string' ? passwordRaw : '';
    if (!email || !password) {
      res.status(400).json({ error: 'email et mot de passe requis' });
      return;
    }
    const user = await userService.verifyCredentials(email, password);
    const token = signToken(user.uid);
    res.status(200).json({
      uid: user.uid,
      pseudo: user.pseudo,
      token,
      message: 'Connexion réussie',
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Erreur serveur' });
  }
}

async function register(req, res) {
  try {
    const emailRaw = req.body && req.body.email;
    const passwordRaw = req.body && req.body.password;
    const pseudoRaw = req.body && req.body.pseudo;
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
    const password = typeof passwordRaw === 'string' ? passwordRaw : '';
    const pseudo = typeof pseudoRaw === 'string' ? pseudoRaw : '';
    if (!email || !password) {
      res.status(400).json({ error: 'email et mot de passe requis' });
      return;
    }
    const user = await userService.createUserWithCredentials(email, password, pseudo);
    const token = signToken(user.uid);
    res.status(200).json({
      uid: user.uid,
      pseudo: user.pseudo,
      token,
      message: 'Compte créé',
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Erreur serveur' });
  }
}

module.exports = { login, register };
