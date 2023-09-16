import { AllowRead, AllowWrite } from "@statebacked/machine-def";
import { prCommentingMachine } from "./machine";

export const allowRead: AllowRead = ({ authContext }) =>
  authContext.sub === "webhook";
export const allowWrite: AllowWrite = ({ authContext }) =>
  authContext.sub === "webhook";

export default prCommentingMachine;
