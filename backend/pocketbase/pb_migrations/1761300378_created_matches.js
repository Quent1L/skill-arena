/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_340646327",
        "hidden": false,
        "id": "relation3177167065",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "tournament",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1568971955",
        "hidden": false,
        "id": "relation1578464216",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "teamA",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1568971955",
        "hidden": false,
        "id": "relation3340509794",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "teamB",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number3481757406",
        "max": null,
        "min": null,
        "name": "scoreA",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number1452160868",
        "max": null,
        "min": null,
        "name": "scoreB",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1568971955",
        "hidden": false,
        "id": "relation217473038",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "winner",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "date972711920",
        "max": "",
        "min": "",
        "name": "played_at",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation257224476",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "validated_by",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor18589324",
        "maxSize": 0,
        "name": "notes",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_2541054544",
    "indexes": [],
    "listRule": null,
    "name": "matches",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2541054544");

  return app.delete(collection);
})
