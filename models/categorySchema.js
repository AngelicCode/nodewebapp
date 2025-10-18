const mongoose = require("mongoose");
const {Schema} = mongoose;

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true

  },
  description: {
    type: String,
    required: true

  },
  isListed: {
    type: Boolean,
    default: true

  },
  categoryOffer: {
    percentage: {
      type: Number,
      default: 0
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now

  }

});

const Category = mongoose.model("Category",categorySchema);

module.exports = Category;