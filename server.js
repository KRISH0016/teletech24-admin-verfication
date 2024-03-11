const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const createCSVWriter = require("csv-writer").createObjectCsvWriter;
const csv = require("csv-parser");
const { requireAuth } = require("./middleware/auth");
const User = require("./models/User");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
// const emailjs = require("@emailjs/nodejs");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
    exposedHeaders: ["set-cookie"],
  })
);
app.use(cookieParser());

const maxAge = 3 * 24 * 60 * 60;

const createToken = (user) => {
  return jwt.sign({ user }, process.env.SECRET_KEY, { expiresIn: maxAge });
};

app.post("/", (req, res) => {
  const { password } = req.body;
  if (password === process.env.PASSWORD) {
    const token = createToken("admin");
    res.cookie("auth_token", token, {
      maxAge: maxAge * 1000,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    res.status(200).json({ msg: "success", user: "admin" });
  } else if (password === process.env.SUB_PASSWORD) {
    const token = createToken("sub_admin");
    res.cookie("auth_token", token, {
      maxAge: maxAge * 1000,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    res.status(200).json({ msg: "success", user: "sub_admin" });
  } else {
    res.status(400).json({ msg: "error" });
  }
});

app.get("/getData", requireAuth, (req, res) => {
  User.find({})
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(400).json({ msg: "err" });
    });
});

app.put("/update", requireAuth, async (req, res) => {
  const { _id, paid, fullName, email, transactionNumber } = req.body;
  User.updateOne(
    { _id: _id },
    { paid: paid, transactionNumber: transactionNumber }
  )
    .then(async (result) => {
      var params = {
        to_name: fullName,
        to_mail: email,
        main_message: paid
          ? "Your Payment has been successfully Verified by the Administrator.\nWe acknowledge your registration for TeleTech'24, our National-level technical symposium at Thiagarajar College of Engineering on March 26, 2024. Please arrive at the campus by 8:30 AM for further instructions. We look forward to your participation..\nRegards, Team TeleTech2024."
          : "Your Payment transaction address is not matched. Please check the transaction id of your Payment and try once again.\n Thank you.\nRegards, Team TeleTech2024.",
      };
      // console.log(params);
      // emailjs
      //   .send(process.env.SERVICE_ID, process.env.TEMPLATE_ID, params, {
      //     publicKey: process.env.PUBLIC_KEY,
      //     privateKey: process.env.PRIVATE_KEY,
      //   })
      //   .then((result) => {
      //     // console.log(result);
      //     // console.log("Email Sent!");
      //   })
      //   .catch((err) => {
      //     // console.log(err);
      //   });
      // res.status(200).json({ msg: "Success" });
      const options = {
        method: "POST",
        body: JSON.stringify(params),
        headers: {
          "Content-Type": "application/json",
        },
      };
      await fetch("https://teletech-mail-service.onrender.com/sendMail", options)
        .then((output) => {
          res.status(200).json({ msg: "Success" });
        })
        .catch((err) => {
          res.status(400).json({ msg: "Error" });
        });
    })
    .catch((err) => {
      res.status(400).json({ msg: "Error" });
    });
});

const studentData = [
  { id: "sno", title: "S No" },
  { id: "email", title: "Email" },
  { id: "fullName", title: "Full Name" },
  { id: "phoneNumber", title: "Phone" },
  { id: "collegeName", title: "College Name" },
  { id: "department", title: "Department" },
  { id: "paid", title: "Paid" },
  { id: "transactionNumber", title: "Transaction Number" },
  { id: "selectedDepartment", title: "Selected Department" },
];

const fileUrl = "./files/userData.csv";

const csvWriter = createCSVWriter({
  path: fileUrl,
  header: studentData,
});

app.get("/downloadData", async (req, res) => {
  try {
    fs.unlinkSync(fileUrl);
  } catch (err) {
    console.log("File Not Found!");
  }

  await User.find({})
    .then((data) => {
      var newList = [];
      data.forEach(
        (
          {
            email,
            fullName,
            phoneNumber,
            collegeName,
            department,
            paid,
            transactionNumber,
            selectedDepartment,
            ...row
          },
          index
        ) => {
          newList.push({
            sno: index + 1,
            email,
            fullName,
            phoneNumber,
            collegeName,
            department,
            paid: paid ? "Yes" : "No",
            transactionNumber,
            selectedDepartment,
          });
        }
      );
      // console.log(newList);
      csvWriter.writeRecords(newList).then((output) => {
        res.status(200).download(fileUrl);
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(400).json({ msg: "error" });
    });
});

mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log("DB CONNECTION SUCCESSFUL");
    app.listen(process.env.PORT, () => {
      console.log("Server Started in PORT: " + process.env.PORT);
    });
  })
  .catch((err) => {
    console.log(err);
  });
