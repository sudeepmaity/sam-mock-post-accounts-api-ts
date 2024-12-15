import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";

const BASE_URL = "http://host.docker.internal:4000";
const CONCURRENCY_LIMIT = 5;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Received event:", JSON.stringify(event));

  try {
    const body = JSON.parse(event.body || "[]");
    console.log("Parsed body:", body);

    if (!Array.isArray(body) || body.length === 0) {
      console.error("Invalid input:", body);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid input: Expected an array of account IDs",
        }),
      };
    }

    const accountIds: string[] = body;

    // Helper function to fetch account data
    const fetchAccountData = async (accountId: string) => {
      try {
        const response = await axios.get(`${BASE_URL}/api/${accountId}`);
        console.log(`Fetched data for ${accountId}:`, response.data);
        return response.data;
      } catch (error: any) {
        console.error(`Error fetching account ${accountId}:`, error.message);
        return null;
      }
    };

    const results: any[] = [];

    // Process accounts in batches of up to CONCURRENCY_LIMIT
    for (let i = 0; i < accountIds.length; i += CONCURRENCY_LIMIT) {
      const batch = accountIds.slice(i, i + CONCURRENCY_LIMIT);
      // Execute the batch concurrently
      const batchResults = await Promise.all(batch.map(fetchAccountData));
      // Filter out null results (failed requests)
      const successfulResults = batchResults.filter((res) => res !== null);
      results.push(...successfulResults);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (error: unknown) {
    console.error("Error processing request:", error);

    if (error instanceof Error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Internal server error",
          error: error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: "Unknown error occurred",
      }),
    };
  }
};
