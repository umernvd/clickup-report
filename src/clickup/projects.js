import { fetchAllPages } from './pagination.js';

export async function getSpaces(client, teamId) {
  const spaces = await fetchAllPages((page) =>
    client.get(`/team/${teamId}/space`, {
      params: { archived: false, page },
    }).then((res) => res.data.spaces)
  );
  return spaces;
}

export async function getFolders(client, spaceId) {
  const folders = await fetchAllPages((page) =>
    client.get(`/space/${spaceId}/folder`, {
      params: { archived: false, page },
    }).then((res) => res.data.folders)
  );
  return folders;
}

export async function getFolderlessLists(client, spaceId) {
  const lists = await fetchAllPages((page) =>
    client.get(`/space/${spaceId}/list`, {
      params: { archived: false, page },
    }).then((res) => res.data.lists)
  );
  return lists;
}

export async function getLists(client, folderId) {
  const lists = await fetchAllPages((page) =>
    client.get(`/folder/${folderId}/list`, {
      params: { archived: false, page },
    }).then((res) => res.data.lists)
  );
  return lists;
}

export async function getAllLists(client, teamId) {
  const spaces = await getSpaces(client, teamId);
  let totalFolders = 0;

  const allLists = await Promise.all(
    spaces.map(async (space) => {
      const [folders, folderlessLists] = await Promise.all([
        getFolders(client, space.id),
        getFolderlessLists(client, space.id),
      ]);

      totalFolders += folders.length;

      const folderLists = await Promise.all(
        folders.map(async (folder) => {
          const lists = await getLists(client, folder.id);
          return lists.map((list) => ({
            ...list,
            spaceName: space.name,
            folderName: folder.name,
            spaceId: space.id,
          }));
        })
      );

      const annotatedFolderless = folderlessLists.map((list) => ({
        ...list,
        spaceName: space.name,
        folderName: 'No Folder',
        spaceId: space.id,
      }));

      return [...annotatedFolderless, ...folderLists.flat()];
    })
  );

  const totalLists = allLists.flat();
  console.log(`Total spaces found: ${spaces.length}`);
  console.log(`Total folders found: ${totalFolders}`);
  console.log(`Total lists found: ${totalLists.length}`);

  return totalLists;
}
