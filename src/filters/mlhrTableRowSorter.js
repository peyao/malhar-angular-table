/*
* Copyright (c) 2013 DataTorrent, Inc. ALL Rights Reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
'use strict';

angular.module('datatorrent.mlhrTable.filters.mlhrTableRowSorter', [])

.filter('mlhrTableRowSorter', function() {
  var column_cache = {};
  function getColumn(columns, id, tableId) {
    var cacheId = tableId + '_' + id;
    if (column_cache.hasOwnProperty(id)) {
      return column_cache[cacheId];
    }
    for (var i = columns.length - 1; i >= 0; i--) {
      if (columns[i].id === id) {
        column_cache[cacheId] = columns[i];
        return columns[i];
      }
    }
  }
  return function tableRowSorter(rows, columns, sortOrder, sortDirection, options) {
    if (!sortOrder.length) {
      return rows;
    }
    var arrayCopy = [];
    for ( var i = 0; i < rows.length; i++) { arrayCopy.push(rows[i]); }
    return arrayCopy.sort(function(a,b) {
      for (var i = 0; i < sortOrder.length; i++) {
        var id = sortOrder[i];
        var column = getColumn(columns, id, options.tableId);
        var dir = sortDirection[id];
        if (column && column.sort) {
          var fn = column.sort;
          var result = dir === '+' ? fn(a,b,options) : fn(b,a,options);
          if (result !== 0) {
            return result;
          }

        }
      }
      return 0;
    });
  };
});