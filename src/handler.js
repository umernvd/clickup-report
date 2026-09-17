import { runPipeline } from './index.js';

/**
 * AWS Lambda handler for the ClickUp Weekly Report pipeline.
 *
 * Triggered by CloudWatch Events (EventBridge) on a weekly schedule.
 * Can also be invoked manually via AWS CLI:
 *   aws lambda invoke --function-name clickup-weekly-report-dev-weeklyReport output.json
 *
 * Environment variables required (set in Lambda console or serverless.yml):
 *   CLICKUP_TOKEN           - ClickUp personal API token
 *   CLICKUP_TEAM_ID         - ClickUp workspace/team ID
 *   GOOGLE_SERVICE_ACCOUNT_KEY - Google service account JSON (single line)
 *   GOOGLE_SPREADSHEET_ID   - Target Google Spreadsheet ID
 *   COST_PER_HOUR           - (Optional) Default cost per hour for users
 */
export const handler = async (event, context) => {
  console.log('Lambda invoked:', JSON.stringify(event));
  console.log('Request ID:', context?.awsRequestId);
  console.log('Remaining time (ms):', context?.getRemainingTimeInMillis?.());

  try {
    const result = await runPipeline();

    console.log('Pipeline completed successfully:', JSON.stringify(result));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Weekly report generated successfully',
        ...result,
      }),
    };
  } catch (error) {
    console.error('Pipeline failed:', error.message);
    console.error('Full error:', error.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Failed to generate weekly report',
        error: error.message,
      }),
    };
  }
};
