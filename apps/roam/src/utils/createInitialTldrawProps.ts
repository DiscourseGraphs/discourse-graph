import {
  TLInstance,
  TLUser,
  TLDocument,
  TLPage,
  TLUserDocument,
  TLUserPresence,
} from "@tldraw/tldraw";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";

export const createInitialTldrawProps = () => {
  const instanceId = TLInstance.createId();
  const userId = TLUser.createCustomId(getCurrentUserUid());
  const documentId = TLDocument.createCustomId("document");
  const pageId = TLPage.createId();
  const userDocument = TLUserDocument.createId();
  const userPresence = TLUserPresence.createId();

  const userRecord: TLUser = {
    ...TLUser.createDefaultProperties(),
    typeName: "user",
    id: userId,
  };
  const instanceRecord: TLInstance = {
    ...TLInstance.createDefaultProperties(),
    currentPageId: pageId,
    userId: userId,
    typeName: "instance",
    id: instanceId,
  };
  const documentRecord: TLDocument = {
    ...TLDocument.createDefaultProperties(),
    typeName: "document",
    id: documentId,
  };
  const pageRecord: TLPage = {
    // ...TLPage.createDefaultProperties(), doesn't add anything?
    index: "a1",
    name: "Page 1",
    typeName: "page",
    id: pageId,
  };
  const userDocumentRecord: TLUserDocument = {
    ...TLUserDocument.createDefaultProperties(),
    userId: userId,
    typeName: "user_document",
    id: userDocument,
  };
  const userPresenceRecord: TLUserPresence = {
    ...TLUserPresence.createDefaultProperties(),
    typeName: "user_presence",
    id: userPresence,
    userId: userId,
  };

  const props = {
    [userId]: userRecord,
    [instanceId]: instanceRecord,
    ["document:document"]: documentRecord,
    [pageId]: pageRecord,
    [userDocument]: userDocumentRecord,
    [userPresence]: userPresenceRecord,
  };
  return props;
};
