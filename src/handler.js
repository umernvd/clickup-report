import { runPipeline } from "./index.js";

export const handler = async (event, context) => {
  console.log("Lambda invoked:", JSON.stringify(event));
  console.log("Request ID:", context.awsRequestId);
  console.log("Remaining time (ms):", context.getRemainingTimeInMillis());

  try {
    const result = await runPipeline();

    console.log("Pipeline completed successfully:", JSON.stringify(result));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Weekly report generated successfully",
        ...result,
      }),
    };
  } catch (error) {
    console.error("Pipeline failed:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Failed to generate weekly report",
      }),
    };
  }
};
