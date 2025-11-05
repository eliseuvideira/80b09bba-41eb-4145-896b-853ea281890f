export type SuccessReply = {
  status: "success";
  data: unknown;
  processedAt: string;
};

export type ErrorReply = {
  status: "error";
  error: {
    message: string;
    type: string;
  };
  processedAt: string;
};
