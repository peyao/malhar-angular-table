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

angular.module('datatorrent.mlhrTable.controllers.MlhrTableController', [
  'datatorrent.mlhrTable.services.mlhrTableSortFunctions',
  'datatorrent.mlhrTable.services.mlhrTableFilterFunctions',
  'datatorrent.mlhrTable.services.mlhrTableFormatFunctions'
])

.controller('MlhrTableController',
  ['$scope','$element','mlhrTableFormatFunctions','mlhrTableSortFunctions','mlhrTableFilterFunctions','$log', '$window', '$filter', '$timeout', function($scope, $element, formats, sorts, filters, $log, $window, $filter, $timeout) {

  // SCOPE FUNCTIONS
  $scope.getSelectableRows = function() {
    var tableRowFilter = $filter('mlhrTableRowFilter');
    return angular.isArray($scope.rows) ? tableRowFilter($scope.rows, $scope.columns, $scope.searchTerms, $scope.filterState, $scope.options) : [];
  };

  $scope.isSelectedAll = function() {
    if (!angular.isArray($scope.rows) || ! angular.isArray($scope.selected)) {
      return false;
    }
    var rows = $scope.getSelectableRows();
    return (rows.length > 0 && rows.length === $scope.selected.length );
  };

  $scope.selectAll = function() {
    $scope.deselectAll();
    // Get a list of filtered rows
    var rows = $scope.getSelectableRows();
    if (rows.length <= 0) return;
    var columns = $scope.columns;
    var selectorKey = null;
    var selectObject = null;
    // Search for selector key in selector column
    for (var i=0; i< columns.length; i++) {
      if (columns[i].selector) { 
        selectorKey = columns[i].key;
        selectObject = columns[i].selectObject;
        $scope.options.__selectionColumn = columns[i];
        break;
      }
    }
    // Verify that selectorKey was found
    if (!selectorKey) {
      throw new Error('Unable to find selector column key for selectAll');
    }
    //select key or entire object from all rows
    for ( var i = 0; i < rows.length; i++) {
      $scope.selected.push(selectObject ? rows[i] : rows[i][selectorKey]); 
    }
  };

  $scope.deselectAll = function() {
    while($scope.selected.length > 0) {
      $scope.selected.pop();
    }
  };

  $scope.toggleSelectAll = function($event) {
    var checkbox = $event.target;
    if (checkbox.checked) {
      $scope.selectAll();
    } else {
      $scope.deselectAll();
    }
  };

  $scope.addSort = function(id, dir) {
    var idx = $scope.sortOrder.indexOf(id);
    if (idx === -1) {
      $scope.sortOrder.push(id);
    }
    $scope.sortDirection[id] = dir;
  };
  $scope.removeSort = function(id) {
    var idx = $scope.sortOrder.indexOf(id);
    if (idx !== -1) {
      $scope.sortOrder.splice(idx, 1);
    }
    delete $scope.sortDirection[id];
  };
  $scope.clearSort = function() {
    $scope.sortOrder = [];
    $scope.sortDirection = {};
  };
  // Checks if columns have any filter fileds
  $scope.hasFilterFields = function() {
    for (var i = $scope.columns.length - 1; i >= 0; i--) {
      if (typeof $scope.columns[i].filter !== 'undefined') {
        return true;
      }
    }
    return false;
  };
  // Clears search field for column, focus on input
  $scope.clearAndFocusSearch = function(columnId) {
    $scope.searchTerms[columnId] = '';
    $element.find('tr.mlhr-table-filter-row th.column-' + columnId + ' input').focus();
  };
  // Toggles column sorting
  $scope.toggleSort = function($event, column) {
    var direction;
    // check if even sortable
    if (!column.sort) {
      return;
    }

    if ( $event.shiftKey ) {
      // shift is down, ignore other columns
      // but toggle between three states
      switch ($scope.sortDirection[column.id]) {
        case '+':
          // Make descending
          $scope.sortDirection[column.id] = '-';
          direction = '-';
          break;
        case '-':
          // Remove from sortOrder and direction
          $scope.removeSort(column.id);
          $scope.$emit('__column.sorted__', {
            id: column.id
          });
          break;
        default:
          // Make ascending
          $scope.addSort(column.id, '+');
          direction = '+';
          break;
      }

    } else {
      // shift is not down, disable other
      // columns but toggle two states
      var lastState = $scope.sortDirection[column.id];
      var replace = true;
      $scope.clearSort();
      if (lastState === '+') {
        $scope.addSort(column.id, '-');
          direction = '-';
      }
      else {
        $scope.addSort(column.id, '+');
          direction = '+';
      }
      
    }
    $scope.$emit('__column.sorted__', {
      id: column.id,
      direction: direction,
      replace: replace
    });
    $scope.saveToStorage();
  };
  // Retrieve className for given sorting state
  $scope.getSortClass = function(sorting) {
    var classes = $scope.options.sortClasses;
    if (sorting === '+') {
      return classes[1];
    }
    if (sorting === '-') {
      return classes[2];
    }
    return classes[0];
  };
  $scope.setColumns = function(columns) {
    $scope.columns = columns;
    $scope.columns.forEach(function(column) {
      // formats
      var format = column.format;
      if (typeof format !== 'function') {
        if (typeof format === 'string') {
          if (typeof formats[format] === 'function') {
            column.format = formats[format];
          }
          else {

            try {
              column.format = $filter(format);
            } catch (e) {
              delete column.format;
              $log.warn('format function reference in column(id=' + column.id + ') ' +
                    'was not found in built-in format functions or $filters. ' +
                    'format function given: "' + format + '". ' +
                    'Available built-ins: ' + Object.keys(formats).join(',') + '. ' + 
                    'If you supplied a $filter, ensure it is available on this module');  
            }

          }
        } else {
          delete column.format;
        }
      }

      // sort
      var sort = column.sort;
      if (typeof sort !== 'function') {
        if (typeof sort === 'string') {
          if (typeof sorts[sort] === 'function') {
            column.sort = sorts[sort](column.key);
          }
          else {
            delete column.sort;
            $log.warn('sort function reference in column(id=' + column.id + ') ' +
                  'was not found in built-in sort functions. ' +
                  'sort function given: "' + sort + '". ' +
                  'Available built-ins: ' + Object.keys(sorts).join(',') + '. ');
          }
        } else {
          delete column.sort;
        }
      }

      // filter
      var filter = column.filter;
      if (typeof filter !== 'function') {
        if (typeof filter === 'string') {
          if (typeof filters[filter] === 'function') {
            column.filter = filters[filter];
          }
          else {
            delete column.filter;
            $log.warn('filter function reference in column(id=' + column.id + ') ' +
                  'was not found in built-in filter functions. ' +
                  'filter function given: "' + filter + '". ' +
                  'Available built-ins: ' + Object.keys(filters).join(',') + '. ');
          }
        } else {
          delete column.filter;
        } 
      }
    });
  };

  $scope.startColumnResize = function($event, column) {

    // Stop default so text does not get selected
    $event.preventDefault();
    $event.originalEvent.preventDefault();
    $event.stopPropagation();

    // init variable for new width
    var new_width = false;

    // store initial mouse position
    var initial_x = $event.pageX;

    // create marquee element
    var $m = $('<div class="column-resizer-marquee"></div>');

    // append to th
    var $th = $($event.target).parent('th');
    $th.append($m);

    // set initial marquee dimensions
    var initial_width = $th.outerWidth();

    function mousemove(e) {
      // calculate changed width
      var current_x = e.pageX;
      var diff = current_x - initial_x;
      new_width = initial_width + diff;
      
      // update marquee dimensions
      $m.css('width', new_width + 'px');
    }

    $m.css({
      width: initial_width + 'px',
      height: $th.outerHeight() + 'px'
    });

    // set mousemove listener
    $($window).on('mousemove', mousemove);

    // set mouseup/mouseout listeners
    $($window).one('mouseup', function(e) {
      e.stopPropagation();
      // remove marquee, remove window mousemove listener
      $m.remove();
      $($window).off('mousemove', mousemove);
      
      // set new width on th
      // if a new width was set
      if (new_width === false) {
        delete column.width;
      } else {
        column.width = Math.max(new_width, 0);
      }
      $scope.$emit('__column.resized__', {
        id: column.id,
        width: column.width
      });
      $scope.saveToStorage();
      $scope.$apply();
    });
  };
  $scope.sortableOptions = {
    axis: 'x',
    handle: '.column-text',
    helper: 'clone',
    placeholder: 'mlhr-table-column-placeholder',
    distance: 5,
    stop: function (event, ui) {
      $scope.$emit('__column.moved__', $scope.columns.map(function(col) { return col.id; }));
    }
  };

  $scope.getActiveColCount = function() {
    var count = 0;
    $scope.columns.forEach(function(col) {
      if (!col.disabled) {
        count++;
      }
    });
    return count;
  };

  $scope.saveToStorage = function() {
    if (!$scope.storage) {
      return;
    }
    // init object to stringify/save
    var state = {};

    // save state objects
    ['sortOrder', 'sortDirection', 'searchTerms'].forEach(function(prop) {
      state[prop] = $scope[prop];
    });

    // serialize columns
    state.columns = $scope.columns.map(function(col) {
      return {
        id: col.id,
        disabled: !!col.disabled,
        width: col.width
      };
    });

    // save non-transient options
    state.options = {};
    ['rowLimit', 'pagingScheme', 'storageHash'].forEach(function(prop){
      state.options[prop] = $scope.options[prop];
    });

    // Save to storage
    $scope.storage.setItem($scope.storageKey, JSON.stringify(state));
  };

  $scope.processStateString = function (stateString) {
    // Try to parse it
    var state;
    try {
      // stateString might be the userOverrides object in the table options.
      // Only parse if it is not an object.
      if (angular.isObject(stateString)) {
        state = stateString;
      } else {
        state = JSON.parse(stateString);
      }

      // if mismatched storage hash, stop loading from storage
      if (state.options.storageHash !== $scope.options.storageHash) {
        return;
      }

      if ($scope.options.overrideSortOrder && $scope.options.overrideSortDirection) {
        $scope.sortOrder = $scope.options.overrideSortOrder;
        $scope.sortDirection = $scope.options.overrideSortDirection;
      } else {
        $scope.sortOrder = state.sortOrder;
        $scope.sortDirection = state.sortDirection;
      }

      if ($scope.options.overrideSearchTerms) {
        $scope.searchTerms = $scope.options.overrideSearchTerms;
      } else {
        $scope.searchTerms = state.searchTerms;
      }

      // validate (compare ids)

      // reorder columns and merge
      var column_ids = state.columns.map(function(col) {
        return col.id;
      });

      $scope.columns.sort(function(a,b) {
        var aNotThere = column_ids.indexOf(a.id) === -1;
        var bNotThere = column_ids.indexOf(b.id) === -1;

        if (aNotThere && bNotThere) {
          return 0;
        }
        if (aNotThere) {
          return 1;
        }
        if (bNotThere) {
          return -1;
        }
        return column_ids.indexOf(a.id) - column_ids.indexOf(b.id);
      });

      $scope.columns.forEach(function(col, i) {
        col.disabled = state.columns[i].disabled;
        if ((state.columns[i].width + '').indexOf('%')) {
          col.width = state.columns[i].width;
        } else {
          var width = parseFloat(state.columns[i].width);
          if (!isNaN(width)) {
            col.width = width;
          }
        }
      });

      // load options
      ['rowLimit', 'pagingScheme', 'storageHash'].forEach(function(prop) {
        $scope.options[prop] = state.options[prop];
      });

    } catch (e) {
      $log.warn('Loading from storage failed!');
    }
  };

  $scope.loadFromStorage = function() {

    if (!$scope.storage) {
      return;
    }

    // Attempt to parse the storage
    var stateString = $scope.storage.getItem($scope.storageKey);

    // Was it there?
    if (!stateString) {
      return;
    }
    $scope.processStateString(stateString);
  };

  $scope.calculateRowLimit = function() {
    if ($scope.options.ignoreDummyRows) {
      $scope.rowLimit = $scope.rows ? $scope.rows.length : 0;
    } else {
      var rowHeight = $scope.options.fixedRowHeight || $scope.scrollDiv.find('.mlhr-table-rendered-rows tr').height();
      $scope.rowHeight = rowHeight || $scope.options.defaultRowHeight || 20;
      $scope.rowLimit = Math.ceil($scope.options.bodyHeight / $scope.rowHeight) + $scope.options.rowPadding*2;
    }
  };

}]);
