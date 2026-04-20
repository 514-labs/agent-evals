To get creds from your currently authed cli user and org they are in:

```
awk -F' *= *' '/^api_key/{print "export HOSTING_CLI_API_KEY="$2} /^email/{print "export HOSTING_CLI_EMAIL="$2} /^org_id/{print "export HOSTING_CLI_ORG_ID="$2}' ~/.fiveonefour/credentials.toml
```
