# Import Functionality Test Plan

## Overview
This document outlines comprehensive test cases for the node import and refresh functionality in the Obsidian Discourse Graph plugin.

---

## 1. Basic Import Functionality

### 1.1 Happy Path - Single Node Import
**Test Case**: Import a single node from another space
- **Prerequisites**: 
  - User is member of at least one group
  - Group has published nodes
  - Node is not already imported
- **Steps**:
  1. Open "Import nodes from another space" command
  2. Select one node from the list
  3. Click "Import"
- **Expected**:
  - File created in `import/[spaceName]/[nodeTitle].md`
  - File contains correct frontmatter with `nodeInstanceId` and `importedFromSpaceId`
  - File content matches database "full" variant
  - File title matches database "direct" variant
  - Success notice displayed

### 1.2 Multiple Nodes Import
**Test Case**: Import multiple nodes from same space
- **Steps**:
  1. Open import modal
  2. Select 3-5 nodes from same space
  3. Click "Import"
- **Expected**:
  - All files created in same `import/[spaceName]/` folder
  - All files have correct metadata
  - Success count matches number of selected nodes

### 1.3 Multiple Nodes from Different Spaces
**Test Case**: Import nodes from multiple spaces simultaneously
- **Steps**:
  1. Select nodes from 2-3 different spaces
  2. Click "Import"
- **Expected**:
  - Files organized in separate folders: `import/[space1]/`, `import/[space2]/`, etc.
  - Each file has correct `importedFromSpaceId` matching its source space

### 1.4 Import All Nodes from Group
**Test Case**: Select and import all available nodes
- **Steps**:
  1. Use "Select All" if available
  2. Import all nodes
- **Expected**:
  - All nodes imported successfully
  - No duplicates created
  - Performance is acceptable (no timeout)

---

## 2. Node Type Mapping

### 2.1 Matching Local Node Type
**Test Case**: Import node with nodeTypeId that matches local node type by name
- **Prerequisites**: 
  - Source space has node type "Question" with ID `node_abc123`
  - Local vault has node type "Question" with ID `node_xyz789`
- **Steps**: Import a node of type "Question"
- **Expected**:
  - Imported file has `nodeTypeId: node_xyz789` (local ID)
  - Not `node_abc123` (source ID)
  - File displays correctly with local node type formatting

### 2.2 Non-Matching Node Type - Auto-Create
**Test Case**: Import node with nodeTypeId that doesn't exist locally
- **Prerequisites**: 
  - Source space has node type "Claim" with specific format/color
  - Local vault doesn't have "Claim" node type
- **Steps**: Import a "Claim" node
- **Expected**:
  - New local node type "Claim" is created
  - New node type has same name, format, color, tag, template, keyImage as source
  - New node type appears in settings
  - Imported file uses the newly created node type ID

### 2.3 Node Type with Missing Schema Data
**Test Case**: Import node where source schema can't be fetched
- **Prerequisites**: 
  - Node has `nodeTypeId` but schema not published/accessible
- **Steps**: Import the node
- **Expected**:
  - Import proceeds with original `nodeTypeId` (no mapping)
  - Or creates node type with fallback values
  - Error logged but import doesn't fail completely

### 2.4 Node Type with Complex Literal Content
**Test Case**: Import node type with nested `literal_content` structure
- **Prerequisites**: 
  - Schema has `literal_content` with nested `source_data` object
- **Steps**: Import node of this type
- **Expected**:
  - Node type created correctly with all nested properties extracted
  - Format, color, tag, template, keyImage all preserved

### 2.5 Node Type with Flat Literal Content
**Test Case**: Import node type with flat `literal_content` structure
- **Prerequisites**: 
  - Schema has flat `literal_content` (no `source_data` nesting)
- **Steps**: Import node of this type
- **Expected**:
  - Node type created correctly from flat structure
  - All properties extracted properly

---

## 3. File Existence and Updates

### 3.1 Import Existing File - Update
**Test Case**: Import node that already exists (same nodeInstanceId + importedFromSpaceId)
- **Prerequisites**: 
  - File already exists with matching `nodeInstanceId` and `importedFromSpaceId`
- **Steps**: Import the same node again
- **Expected**:
  - Existing file is updated (not duplicated)
  - File content refreshed from database
  - File remains in same location
  - No duplicate files created

### 3.2 Import with Title Change
**Test Case**: Refresh imported file where title changed in source
- **Prerequisites**: 
  - File exists: `import/Space1/Old Title.md`
  - Source title changed to "New Title"
- **Steps**: Refresh the file
- **Expected**:
  - File renamed to `import/Space1/New Title.md`
  - Content updated
  - Frontmatter preserved (`nodeInstanceId`, `importedFromSpaceId`)

### 3.3 Import with Path Conflict (Different nodeInstanceId)
**Test Case**: Import node where target path exists but different nodeInstanceId
- **Prerequisites**: 
  - File exists: `import/Space1/Title.md` with different `nodeInstanceId`
  - Importing node with same title but different `nodeInstanceId`
- **Steps**: Import the node
- **Expected**:
  - New file created as `import/Space1/Title (1).md`
  - Both files coexist correctly
  - Each has correct `nodeInstanceId`

### 3.4 File in Wrong Location
**Test Case**: File exists but in wrong folder (e.g., root instead of import/)
- **Prerequisites**: 
  - File exists at root: `Title.md` with matching `nodeInstanceId` + `importedFromSpaceId`
- **Steps**: Import/refresh the node
- **Expected**:
  - File moved to correct `import/[spaceName]/` folder
  - Or file updated in place (depending on implementation)

---

## 4. Space Name Handling

### 4.1 Space Name with Special Characters
**Test Case**: Import from space with special characters in name
- **Prerequisites**: 
  - Space name: "Test Space / With-Special_Chars"
- **Steps**: Import nodes from this space
- **Expected**:
  - Folder name sanitized: `import/Test Space  With-Special_Chars/`
  - Files created successfully
  - No filesystem errors

### 4.2 Space Name Fetch Failure
**Test Case**: Space name can't be fetched (RLS/permission issue)
- **Prerequisites**: 
  - User has access to nodes but not space metadata
- **Steps**: Import nodes from this space
- **Expected**:
  - `ensureSpaceNames` retries and handles gracefully
  - Uses fallback: `import/space-[id]/` or throws descriptive error
  - Import proceeds if possible

### 4.3 Space Name with Very Long Name
**Test Case**: Import from space with very long name
- **Prerequisites**: 
  - Space name > 200 characters
- **Steps**: Import nodes
- **Expected**:
  - Folder name truncated or handled appropriately
  - No filesystem path length errors

### 4.4 Multiple Spaces with Similar Names
**Test Case**: Import from spaces with similar/duplicate names
- **Prerequisites**: 
  - Two spaces both named "Test Space"
- **Steps**: Import from both
- **Expected**:
  - Files organized correctly (may need space ID in folder name)
  - No conflicts or overwrites

---

## 5. DataCore Integration

### 5.1 DataCore Available
**Test Case**: Find existing file with DataCore enabled
- **Prerequisites**: 
  - DataCore plugin installed and enabled
  - File exists with matching `nodeInstanceId` + `importedFromSpaceId`
- **Steps**: Import/refresh node
- **Expected**:
  - `findExistingImportedFile` uses DataCore query
  - Fast lookup (no full vault scan)
  - File found correctly

### 5.2 DataCore Unavailable
**Test Case**: Find existing file without DataCore
- **Prerequisites**: 
  - DataCore plugin not installed or disabled
- **Steps**: Import/refresh node
- **Expected**:
  - Falls back gracefully (returns null)
  - Import still works (creates new file)
  - No errors thrown

### 5.3 DataCore Query Error
**Test Case**: DataCore query throws error
- **Prerequisites**: 
  - DataCore installed but query fails
- **Steps**: Import/refresh node
- **Expected**:
  - Error caught and logged
  - Falls back gracefully
  - Import continues

### 5.4 DataCore Returns Multiple Matches
**Test Case**: DataCore query returns multiple files (shouldn't happen but test)
- **Prerequisites**: 
  - Multiple files with same `nodeInstanceId` + `importedFromSpaceId` (data inconsistency)
- **Steps**: Find existing file
- **Expected**:
  - Returns first match
  - Warning logged about multiple matches
  - Import proceeds with first file

---

## 6. Database and Network Errors

### 6.1 Missing Direct Variant
**Test Case**: Node exists but "direct" variant missing
- **Prerequisites**: 
  - Node in database without "direct" variant content
- **Steps**: Import node
- **Expected**:
  - Import fails for this node
  - Error message: "No direct variant found"
  - Other nodes still import successfully
  - Failed count incremented

### 6.2 Missing Full Variant
**Test Case**: Node exists but "full" variant missing
- **Prerequisites**: 
  - Node in database without "full" variant content
- **Steps**: Import node
- **Expected**:
  - Import fails for this node
  - Error message: "No full variant found"
  - Other nodes still import successfully

### 6.3 Database Connection Error
**Test Case**: Database connection fails during import
- **Prerequisites**: 
  - Network disconnected or database unavailable
- **Steps**: Attempt import
- **Expected**:
  - Error caught and displayed to user
  - Partial imports rolled back or marked as failed
  - Clear error message

### 6.4 RLS Policy Blocking Access
**Test Case**: User doesn't have permission to access node content
- **Prerequisites**: 
  - Node exists but RLS policy blocks access
- **Steps**: Attempt import
- **Expected**:
  - Query returns null/empty
  - Import fails for this node
  - Error logged appropriately
  - Other accessible nodes still import

### 6.5 Schema Not Published
**Test Case**: Node type schema not published to group
- **Prerequisites**: 
  - Node exists but its schema not accessible via ResourceAccess
- **Steps**: Import node
- **Expected**:
  - Node type mapping fails gracefully
  - Uses original `nodeTypeId` or creates with fallback
  - Import still succeeds

---

## 7. Frontmatter Handling

### 7.1 File with Only Frontmatter (No Body)
**Test Case**: Import node with only YAML frontmatter, no body content
- **Prerequisites**: 
  - Source content: `---\nnodeTypeId: ...\n---\n` (no body)
- **Steps**: Import node
- **Expected**:
  - File created correctly
  - Frontmatter parsed properly
  - Empty body handled gracefully

### 7.2 Frontmatter with Special Characters
**Test Case**: Import node with special characters in frontmatter values
- **Prerequisites**: 
  - Frontmatter contains quotes, colons, newlines in values
- **Steps**: Import node
- **Expected**:
  - Frontmatter preserved correctly
  - No parsing errors
  - Special characters escaped properly

### 7.3 Frontmatter with Arrays
**Test Case**: Import node with array values in frontmatter
- **Prerequisites**: 
  - Frontmatter contains `publishedToGroups: [id1, id2]`
- **Steps**: Import node
- **Expected**:
  - Arrays preserved in frontmatter
  - `publishedToGroups` removed (as per implementation)
  - Other arrays handled correctly

### 7.4 Missing nodeInstanceId in Source
**Test Case**: Source content missing nodeInstanceId in frontmatter
- **Prerequisites**: 
  - Database content has frontmatter without `nodeInstanceId`
- **Steps**: Import node
- **Expected**:
  - `nodeInstanceId` added from import process
  - File created with correct `nodeInstanceId`

### 7.5 Frontmatter Update After Import
**Test Case**: Verify frontmatter is correctly set after import
- **Steps**: 
  1. Import node
  2. Check file frontmatter
- **Expected**:
  - `nodeInstanceId` matches source
  - `importedFromSpaceId` matches source space
  - `nodeTypeId` is mapped to local ID
  - `publishedToGroups` removed
  - Other frontmatter preserved

---

## 8. Refresh Functionality

### 8.1 Refresh Single File
**Test Case**: Refresh one imported file
- **Prerequisites**: 
  - File exists with `importedFromSpaceId` and `nodeInstanceId`
  - Source content updated in database
- **Steps**: 
  1. Open file in Discourse Context view
  2. Click "🔄 Refresh" button
- **Expected**:
  - File content updated from database
  - File title updated if changed
  - Success notice displayed
  - Frontmatter preserved

### 8.2 Refresh All Files
**Test Case**: Refresh all imported files via command
- **Prerequisites**: 
  - Multiple imported files exist
  - Some have updates in database
- **Steps**: 
  1. Run "Fetch latest content from imported nodes" command
  2. Wait for completion
- **Expected**:
  - All files refreshed
  - Success/failed counts displayed
  - Errors logged for failed files
  - Notice shows summary

### 8.3 Refresh File with Missing Metadata
**Test Case**: Refresh file missing `importedFromSpaceId` or `nodeInstanceId`
- **Prerequisites**: 
  - File exists but missing required frontmatter
- **Steps**: Attempt refresh
- **Expected**:
  - Error returned: "File is not an imported file"
  - No database queries attempted
  - File not modified

### 8.4 Refresh File Not in Database
**Test Case**: Refresh file where source node deleted from database
- **Prerequisites**: 
  - File exists locally
  - Source node no longer in database
- **Steps**: Attempt refresh
- **Expected**:
  - Error: "Could not fetch latest content"
  - File not modified
  - Error logged

### 8.5 Refresh During Import
**Test Case**: Refresh file while import is in progress
- **Prerequisites**: 
  - Import operation running
- **Steps**: 
  1. Start import
  2. Immediately try to refresh a file being imported
- **Expected**:
  - Operations don't conflict
  - Both complete successfully
  - Or refresh waits/queues appropriately

---

## 9. UI/UX Scenarios

### 9.1 Modal Loading States
**Test Case**: Verify loading states in ImportNodesModal
- **Steps**: 
  1. Open import modal
  2. Observe loading state
  3. Wait for nodes to load
- **Expected**:
  - Loading indicator shown
  - Nodes appear when ready
  - No flickering or empty states

### 9.2 Empty Groups
**Test Case**: User has groups but no published nodes
- **Prerequisites**: 
  - User is member of groups
  - Groups have no published nodes
- **Steps**: Open import modal
- **Expected**:
  - Empty state message displayed
  - No errors thrown
  - Modal can be closed

### 9.3 No Groups
**Test Case**: User is not member of any groups
- **Prerequisites**: 
  - User has no group memberships
- **Steps**: Open import modal
- **Expected**:
  - Empty state or error message
  - Clear indication of why no nodes available

### 9.4 Large Node Lists
**Test Case**: Import modal with 100+ nodes
- **Prerequisites**: 
  - Groups have 100+ published nodes
- **Steps**: 
  1. Open import modal
  2. Scroll through list
  3. Select multiple nodes
- **Expected**:
  - List renders efficiently
  - Scrolling is smooth
  - Selection works correctly
  - Import completes in reasonable time

### 9.5 Filtering/Search (if implemented)
**Test Case**: Search/filter nodes in import modal
- **Steps**: 
  1. Open import modal
  2. Use search/filter if available
- **Expected**:
  - Filtering works correctly
  - Results update in real-time
  - Selection state preserved

### 9.6 Selection State Persistence
**Test Case**: Selection state during loading/refreshing
- **Steps**: 
  1. Select nodes
  2. Trigger refresh/reload
- **Expected**:
  - Selection preserved or cleared appropriately
  - No state corruption

---

## 10. File System Edge Cases

### 10.1 Invalid File Names
**Test Case**: Import node with invalid characters in title
- **Prerequisites**: 
  - Source title: `File/With\Invalid:Chars<>|?*`
- **Steps**: Import node
- **Expected**:
  - File name sanitized
  - Invalid characters removed/replaced
  - File created successfully

### 10.2 Very Long File Names
**Test Case**: Import node with very long title (>255 chars)
- **Prerequisites**: 
  - Source title > 255 characters
- **Steps**: Import node
- **Expected**:
  - File name truncated appropriately
  - No filesystem errors
  - File created successfully

### 10.3 Reserved File Names
**Test Case**: Import node with reserved filename (e.g., "CON", "PRN" on Windows)
- **Prerequisites**: 
  - Source title is reserved name
- **Steps**: Import node
- **Expected**:
  - File name sanitized/renamed
  - No filesystem errors

### 10.4 Folder Creation Permissions
**Test Case**: Import when import/ folder can't be created
- **Prerequisites**: 
  - Insufficient permissions or disk full
- **Steps**: Attempt import
- **Expected**:
  - Error caught and displayed
  - Clear error message
  - Partial imports handled gracefully

### 10.5 Disk Space Full
**Test Case**: Import when disk is full
- **Prerequisites**: 
  - Vault disk is full
- **Steps**: Attempt import
- **Expected**:
  - Error caught
  - Clear error message
  - No partial/corrupted files

---

## 11. Sync Integration

### 11.1 Imported Files Not Synced
**Test Case**: Verify imported files don't sync back to database
- **Prerequisites**: 
  - File imported with `importedFromSpaceId`
- **Steps**: 
  1. Modify imported file
  2. Wait for sync
- **Expected**:
  - File changes not synced to database
  - File not in sync queue
  - `shouldSyncFile` returns false

### 11.2 Imported File Without importedFromSpaceId
**Test Case**: Edge case - file missing `importedFromSpaceId` but should be imported
- **Prerequisites**: 
  - File in import/ folder but missing frontmatter
- **Steps**: Modify file
- **Expected**:
  - File not synced (if in import/ folder)
  - Or synced if not marked as imported

### 11.3 Refresh Updates File - No Sync
**Test Case**: Refresh updates file, verify it doesn't trigger sync
- **Steps**: 
  1. Refresh imported file
  2. Check sync queue
- **Expected**:
  - File updated
  - File not queued for sync
  - `importedFromSpaceId` preserved

---

## 12. Error Handling and Recovery

### 12.1 Partial Import Failure
**Test Case**: Some nodes import successfully, others fail
- **Prerequisites**: 
  - 5 nodes selected
  - 2 nodes have database errors
- **Steps**: Import all 5
- **Expected**:
  - 3 nodes imported successfully
  - 2 nodes fail with errors
  - Success/failed counts accurate
  - Error messages for failed nodes

### 12.2 Import Interruption
**Test Case**: Import interrupted (app closed, network lost)
- **Steps**: 
  1. Start large import
  2. Interrupt mid-process
- **Expected**:
  - Already imported files remain
  - No corrupted files
  - Can resume/retry remaining nodes

### 12.3 Concurrent Imports
**Test Case**: Multiple import operations simultaneously
- **Steps**: 
  1. Open two import modals
  2. Import from both
- **Expected**:
  - Operations don't conflict
  - Both complete successfully
  - Or second operation waits/queues

### 12.4 Error Messages Clarity
**Test Case**: Verify error messages are user-friendly
- **Steps**: Trigger various error conditions
- **Expected**:
  - Error messages clear and actionable
  - Technical details in console, user-friendly in UI
  - No stack traces shown to user

---

## 13. Performance Tests

### 13.1 Large Batch Import
**Test Case**: Import 50+ nodes
- **Steps**: Import 50 nodes
- **Expected**:
  - Completes in reasonable time (< 2 minutes)
  - Progress indicator shows progress
  - No memory leaks
  - UI remains responsive

### 13.2 DataCore Performance
**Test Case**: Compare performance with/without DataCore
- **Steps**: 
  1. Import with DataCore enabled
  2. Import with DataCore disabled
- **Expected**:
  - DataCore version significantly faster
  - Both complete successfully
  - No functional differences

### 13.3 Refresh All Performance
**Test Case**: Refresh 100+ imported files
- **Steps**: Refresh all imported files
- **Expected**:
  - Completes in reasonable time
  - Progress shown
  - No timeout errors

---

## 14. Data Integrity

### 14.1 NodeInstanceId Uniqueness
**Test Case**: Verify nodeInstanceId + importedFromSpaceId uniqueness
- **Prerequisites**: 
  - Two files with same combination (shouldn't happen)
- **Steps**: Import/refresh
- **Expected**:
  - Only one file updated/created
  - Warning logged if duplicates found

### 14.2 Frontmatter Consistency
**Test Case**: Verify frontmatter consistency after import/refresh
- **Steps**: 
  1. Import node
  2. Check frontmatter
  3. Refresh node
  4. Check frontmatter again
- **Expected**:
  - `nodeInstanceId` never changes
  - `importedFromSpaceId` never changes
  - `nodeTypeId` mapped correctly and consistently

### 14.3 Content Integrity
**Test Case**: Verify imported content matches source
- **Steps**: 
  1. Import node
  2. Compare file content with database
- **Expected**:
  - Content matches exactly
  - No data loss or corruption
  - Encoding handled correctly (UTF-8)

---

## 15. Regression Tests

### 15.1 Re-import After Delete
**Test Case**: Delete imported file, then re-import
- **Steps**: 
  1. Import node
  2. Delete file
  3. Re-import same node
- **Expected**:
  - File recreated successfully
  - Same location and content
  - No errors

### 15.2 Import After Local Modification
**Test Case**: Import node, modify locally, then refresh
- **Steps**: 
  1. Import node
  2. Manually edit file content
  3. Refresh file
- **Expected**:
  - Local changes overwritten with database content
  - Frontmatter preserved correctly

### 15.3 Multiple Refresh Cycles
**Test Case**: Refresh same file multiple times
- **Steps**: 
  1. Import node
  2. Refresh 5 times in succession
- **Expected**:
  - Each refresh succeeds
  - No errors accumulate
  - File state consistent

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Create test spaces with various node types
- [ ] Create test groups and publish nodes
- [ ] Set up test vault with/without DataCore
- [ ] Prepare test data (nodes with various characteristics)
- [ ] Document expected database state

### Test Execution
- [ ] Execute all test cases systematically
- [ ] Document actual results vs expected
- [ ] Capture screenshots for UI tests
- [ ] Log console errors/warnings
- [ ] Measure performance metrics

### Post-Test Validation
- [ ] Verify no files left in inconsistent state
- [ ] Check database for any unintended changes
- [ ] Verify all imported files have correct metadata
- [ ] Clean up test files
- [ ] Document any bugs found

---

## Priority Levels

**P0 (Critical - Must Test)**:
- 1.1, 1.2, 1.3 (Basic import)
- 2.1, 2.2 (Node type mapping)
- 3.1, 3.2 (File updates)
- 6.1, 6.2 (Database errors)
- 8.1, 8.2 (Refresh functionality)
- 11.1 (Sync integration)

**P1 (High - Should Test)**:
- 2.3, 2.4, 2.5 (Node type edge cases)
- 4.1, 4.2 (Space name handling)
- 5.1, 5.2 (DataCore)
- 7.1, 7.2 (Frontmatter)
- 9.1, 9.2 (UI states)
- 12.1, 12.2 (Error handling)

**P2 (Medium - Nice to Test)**:
- 3.3, 3.4 (File conflicts)
- 4.3, 4.4 (Space name edge cases)
- 5.3, 5.4 (DataCore edge cases)
- 10.1-10.5 (File system)
- 13.1-13.3 (Performance)

**P3 (Low - Optional)**:
- 9.3-9.6 (Advanced UI)
- 12.3, 12.4 (Advanced error handling)
- 14.1-14.3 (Data integrity)
- 15.1-15.3 (Regression)

---

## Notes

- Test in both development and production-like environments
- Test with various Obsidian versions if applicable
- Test with different vault sizes (small, medium, large)
- Test with different network conditions (fast, slow, intermittent)
- Consider automated testing for critical paths
- Maintain test data sets for consistent testing
