/* The finding the overview shows as a printed page. */
export const SAMPLE_TITLE = "SQL injection in the login form";
export const SAMPLE_VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
export const SAMPLE_BODY = `## Description

The login form builds its SQL query by joining user input into the query text, so anything typed into \`username\` runs as SQL.

## Steps to reproduce

1. Open the login page.
2. Send the request below. The response is the admin dashboard.

\`\`\`http
POST /login HTTP/1.1
Host: app.example.com

username=admin'--&password=x
\`\`\`

## Remediation

Use **parameterised queries** for every database call.
`;
