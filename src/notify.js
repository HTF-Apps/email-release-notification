const fs           = require('fs');
const axios        = require('axios');
const showdown     = require('showdown');
const sendgridMail = require('@sendgrid/mail');

const setCredentials = () => sendgridMail.setApiKey(process.env.SENDGRID_API_TOKEN);

async function prepareMessage(recipients, lists) {
  const { repository, release } = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));

  const converter = new showdown.Converter();
  const repoName = repository.name;
  const repoURL = repository.html_url;
  const repoDescription = repository.description ? `, ${repository.description.charAt(0).toLowerCase()+repository.description.slice(1)}` : '';
  const releaseVersion = release.tag_name;
  const releaseName = release.name;
  const releaseURL = release.html_url;
  const ownerResponse = await axios.get(repository.owner.url);
  const ownerName = ownerResponse.data.name;

  // Templates
  const subject = `${repoName} ${releaseVersion} [${releaseName}] ${((release.prerelease == true) ? 'pre-' : '')}released!`;
  const footer = `\n\nRegards,\n\nThe ${ownerName} team`;
  const header = `[${repoName}](${repoURL})${repoDescription} reached it's [${releaseVersion}](${releaseURL}) version.`;

  const releaseBody = converter.makeHtml(`${header}\n\n${release.body}${footer}`);
  //const releaseBody = converter.makeHtml(`${header}\n\n${JSON.stringify(release)}${footer}`);

  const sender = process.env.SENDER_EMAIL;

  return {
    from: {
      name: ownerName,
      email: sender,
    },
    to: sender,
    cc: lists,
    bcc: recipients,
    subject,
    html: releaseBody,
  };
}
async function run(recipientsUrl, distributionLists) {
  const { data } = await axios.get(recipientsUrl);
  const recipients = data.split(/\r\n|\n|\r/);
  const lists = distributionLists ? distributionLists.split(',') : [];
  const message = await prepareMessage(recipients, lists);
  await sendgridMail.send(message);
  console.log('Mail sent!');
}

/**
 * Run
 */
setCredentials();
run(process.env.RECIPIENTS_URL, process.env.DISTRIBUTION_LISTS)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
