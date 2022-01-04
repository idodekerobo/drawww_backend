import express, { Request, Response } from 'express';
const { Client } = require("@notionhq/client")
const router = express.Router();

const notion = new Client({
  auth: process.env.NOTION_RAFFLE_EMAIL_TOKEN,
})

router.post('/addEmail', async (req: Request, res: Response) => {
   console.log(req.body.emailAddress)
   try {
      await notion.pages.create({
         parent: {
            database_id: '2ead84131c3f4ff8823cc41dbd31f903'
         },
         properties: {
            'email': {
               type: 'title',
               title: [
                  { 
                     type: 'text',
                     text: { content: req.body.emailAddress },
                  },
               ]
            },
         },
      });
      res.send({
         success: 'yes',
      })
   } catch (err) {
      console.log('error adding email');
      console.log(err);
      res.send({
         success: 'no',
      })
   }

})

module.exports = router;