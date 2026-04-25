// api/services/github.js
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

async function getFileFromGitHub(path) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    }
  });

  if (!res.ok) throw new Error(`GitHub GET error: ${res.status}`);

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function commitToGitHub(path, content, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const encoded = Buffer.from(content).toString('base64');

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: encoded, sha })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit error: ${res.status} — ${err}`);
  }
}

export { getFileFromGitHub, commitToGitHub };
