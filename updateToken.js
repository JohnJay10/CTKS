const mongoose = require('mongoose');
const Token = require('./models/Token');
const TokenRequest = require('./models/TokenRequest');

async function updateOldTokensWithTxRef() {
   await mongoose.connect('mongodb+srv://jaiyeolahjohn:eE5L4QJJo2WeQMFD@ctk.a3uk31a.mongodb.net/CTK', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const tokens = await Token.find({ txRef: { $exists: false } });

  for (const token of tokens) {
    const match = await TokenRequest.findOne({
      meterNumber: token.meterNumber,
      amount: token.amount,
      vendorId: token.vendorId,
    }).sort({ createdAt: -1 });

    if (match) {
      token.txRef = match.txRef;
      await token.save();
      console.log(`Updated token ${token.tokenId} with txRef ${match.txRef}`);
    } else {
      console.warn(`No match found for token ${token.tokenId}`);
    }
  }

  mongoose.connection.close();
}

updateOldTokensWithTxRef().catch(console.error);
