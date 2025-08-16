const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const errorLogger = require("./middleware/errorLogger");

require("dotenv").config();

const app = express();
app.use(cors());

app.use(morgan("dev"));
app.use(express.json());

app.use("/api/users", require("./routes/usersRoutes"));
app.use("/api/pets", require("./routes/petsRoutes"));

// ודא שיש auth שמכניס req.user.id
app.use("/api/expenses", require("./routes/expensesRoutes"));
app.use("/api/medical-records", require("./routes/medicalRecordsRoutes"));
app.use("/api/reminders", require("./routes/remindersRoutes"));

app.use("/api/places", require("./routes/placesRoutes"));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));

app.use(errorLogger);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
