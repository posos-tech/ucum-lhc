/**
 * This class handles the parsing of a unit string into a unit object
 */
var UnitTables = require('./unitTables.js').UnitTables;
var PrefixTables = require('./prefixTables.js').PrefixTables;

export class UnitString{

  /**
   * Constructor
   */
  constructor() {
    // nothing really to do here.
  }

  /**
   * Parses a unit string, returns a unit
   *
   * @params uStr the string defining the unit
   * @returns a unit object, or null if problems creating the unit
   */
  parseString(uStr) {
    let finalUnit = null ;

    // Check for parentheses in unit strings. We assume there aren't any,
    // so if some turn up we need to know so they can be parsed.  For now,
    // block further processing of strings with parentheses.
    let pArray = uStr.split('(') ;
    if (pArray.length > 1) {
      throw (new Error(`Unit string (${uStr}) contains parentheses, which ` +
             'are not handled yet by this package.  Sorry'));
    }

    // Call makeUnitsArray to convert the string to an array of unit
    // descriptors with operators.
    let uArray = this.makeUnitsArray(uStr);

    // create a unit object out of each un element
    let uLen = uArray.length;
    for (let u1 = 0; u1 < uLen; u1++) {
      let curCode = uArray[u1]['un'];
      if (curCode) {
        let curCodeNum = Number(curCode);
        // if the current unit string is NOT a number, call makeUnit to create
        // the unit object for it
        if (isNaN(curCodeNum)) {
          uArray[u1]['un'] = this.makeUnit(curCode);
        }
        // Otherwise write the numeric version of the number back to
        // the uArray 'un' element
        else {
          uArray[u1]['un'] = curCodeNum;
        }
      }
    }

    // Process the units (and numbers) to create one final unit object
    if (uArray[0] == null || uArray == "'" || uArray[0]['un'] === undefined ||
        uArray[0]['un'] == null) {
      // assume this is an instance of /number or /something, e.g. "/24"
      // not sure what to do with this yet
      throw (new Error(`Unit string (${uStr}) did not contain anything that ` +
             'could be used to create a unit, or else something that is not ' +
             'handled yet by this package.  Sorry'));

    }

    finalUnit = uArray[0]['un'];

    // Perform the arithmetic for the units, starting with the first 2.
    // We only need to do the arithmetic if we have more than one unit
    for (var u2 = 1; u2 < uLen; u2++) {
      let nextUnit = uArray[u2]['un'];
      if ((typeof nextUnit !== 'number') && (!nextUnit.getProperty)) {
        throw (new Error(`Unit string (${uStr}) contains unrecognized ` +
            `element (${nextUnit.toString()}); could not parse full ` +
            'string.  Sorry'));
      }

      // Is the operation division?
      let isDiv = uArray[u2]['op'] === '/' ;

      // Perform the operation based on the type(s) of the operands

      if (typeof nextUnit !== 'number') {
        // both are unit objects
        if (typeof finalUnit !== 'number') {
          isDiv ? finalUnit = finalUnit.divide(nextUnit) :
              finalUnit = finalUnit.multiplyThese(nextUnit);
        }
        // finalUnit is a number; nextUnit is a unit object
        else {
          let nMag = nextUnit.getProperty('magnitude_');
          isDiv ? nMag = finalUnit/nMag : nMag *= finalUnit ;
          finalUnit = nextUnit;
          finalUnit.assignVals({'magnitude_': nMag});
        }
      } // end if nextUnit is not a number
      else {
        // nextUnit is a number; finalUnit is a unit object
        if (typeof finalUnit !== 'number') {
          let fMag = finalUnit.getProperty('magnitude_');
          isDiv ? fMag /= nextUnit :
              fMag *= nextUnit;
          finalUnit.assignVals({'magnitude_': fMag});
        }
        // both are numbers
        else {
          isDiv ? finalUnit /= nextUnit :
              finalUnit *= nextUnit ;
        }
      } // end if nextUnit is a number

    } // end do for each unit after the first one

    return finalUnit;
  } // end parseString


  /**
   * Breaks the unit string into an array of unit descriptors and operators.
   *
   * @param uStr the unit string being parsed
   * @returns the array representing the unit string
   */
  makeUnitsArray(uStr) {

    // Separate the string into pieces based on delimiters / (division) and .
    // (multiplication).  The idea is to get an array of units on which we
    // can then perform any operations (prefixes, multiplication, division).

    let uArray1 = uStr.match(/([./]|[^./]+)/g) ;

    // If the first element in the array is a division operator (/), the
    // string started with '/'.  Add A first element containing 1 to the
    // array, which will cause the correct computation to be performed (inversion).
    if (uArray1[0] == "/") {
      uArray1.unshift("1");
    }

    // Create an array of unit/operator objects.  The unit is, for now, the
    // alphanumeric description of the unit (e.g., Hz for hertz) including
    // a possible prefix and exponent.   The operator is the operator to be
    // applied to that unit and the one preceding it.  So, a.b would give
    // us two objects.  The first will have a unit of a, and a blank operator
    // (because it's the first unit).  The second would have a unit of b
    // and the multiplication operator (.).
    let u1 = uArray1.length ;
    let uArray = [{un: uArray1[0], op: ""}] ;
    for (let n = 1; n < u1; n++) {
      uArray.push({op: uArray1[n++], un: uArray1[n]});
    }
    return uArray ;
  } // end makeUnitsArray


  /**
   * Creates a unit object from a string defining one unit.  The string
   * should consist of a unit code for a unit already defined (base or
   * otherwise).  It may include a prefix and an exponent, e.g., cm2
   * (centimeter squared).
   *
   * @params uCode the string defining the unit
   * @returns a unit object, or null if problems creating the unit
   */
  makeUnit(uCode) {
    let exp = null;
    let pfxVal = null;
    let pfxCode = null;
    let pfxExp = null ;
    let ulen = uCode.length ;

    // if the code is only one character, no parsing needed. Also block ones
    // that begin with 10 for now.
    //if (ulen > 1 && uCode.substr(0,2) != "10") {
    if (ulen > 1) {
      // check for a prefix.  If we find one, move it and its value out of
      // the uCode string.  Try for a single character prefix first and then
      // try for a 2-character prefix if a single character prefix is not found.
      let pfxTabs = PrefixTables.getInstance();
      pfxCode = uCode.charAt(0);
      let pfxObj = pfxTabs.getPrefixByCode(pfxCode);
      if (!pfxObj && uCode.length >= 2) {
        pfxCode = uCode.substr(0, 2);
        pfxObj = pfxTabs.getPrefixByCode(pfxCode);
      }
      if (pfxObj) {
        pfxVal = pfxObj.getValue();
        pfxExp = pfxObj.getExp();
        let pCodeLen = pfxCode.length;
        uCode = uCode.substr(pCodeLen);
        ulen -= pCodeLen;
      }
      else {
        pfxCode = null;
      }

      // Now look for an exponent at the end of the unit
      let res = uCode.match(/([^-+\d]*)([-+\d]*)/);
      if (res && res[2] && res[2] !== "") {
        uCode = res[1];
        if (res[2] !== '')
          exp = res[2];

        // check for something like m2 or the code being just a number
        // in the case of m2, m was interpreted as a prefix (see fix below).
        if (typeof uCode === 'number' && pfxCode) {
          uCode = pfxCode;
          pfxCode = null;
          pfxVal = null;
          pfxExp = null;
        }
      } // end if the unit code is longer than one character
    } // end if we got a return from the exponent match search

    let utabs = UnitTables.getInstance();

    // go get the unit for the code (without prefix or exponent)
    let origUnit = utabs.getUnitByCode(uCode);
    // if we didn't find the unit but we do have a prefix, see if we're
    // looking at a case where a base unit code was interpreted as a prefix,
    // e.g., m2 or cd - Hm - this is not going to work for cd when the user
    // enters it.   TODO.
    if (!origUnit && pfxCode) {
      uCode = pfxCode + uCode ;
      pfxCode = null;
      pfxVal = null ;
      pfxExp = null ;
      origUnit = utabs.getUnitByCode(uCode) ;
    }
    let retUnit = null;
    if (origUnit) {
      // clone the unit we just got and then apply any exponent and/or prefix
      // to it
      retUnit = origUnit.clone();
      let theDim = retUnit.getProperty('dim_');
      let theMag = retUnit.getProperty('magnitude_');
      let theName = retUnit.getProperty('name_');
      // If there is an exponent for the unit, apply it to the dimension
      // and magnitude now
      if (exp) {
        exp = parseInt(exp);
        theDim = theDim.mul(exp);
        theMag = Math.pow(theMag, exp);
        retUnit.assignVals({'magnitude_': theMag});

        // If there is also a prefix, apply the exponent to the prefix.
        if (pfxVal) {

          // if the prefix base is 10 it will have an exponent.  Multiply the
          // current prefix exponent by the exponent for the unit we're
          // working with.  Then raise the prefix value to the level
          // defined by the exponent.
          if (pfxExp) {
            exp *= pfxExp;
            pfxVal = Math.pow(10, exp);
          }
          // if the prefix base is not 10, it won't have an exponent.
          // At the moment I don't see any units using the prefixes
          // that aren't base 10.   But if we get one the prefix value
          // will be applied to the magnitude (below), which is what
          // we want anyway.
        } // end if there's a prefix as well as the exponent
      } // end if there's an exponent

      // Now apply the prefix, if there is one, to the magnitude
      if (pfxVal) {
        theMag *= pfxVal ;
        retUnit.assignVals({'magnitude_': theMag})
      }
    } // end if we found a unit object
    return retUnit ;
  } // ret makeUnit


  /**
   * Creates a unit string that indicates multiplication of the two
   * units referenced by the codes passed in.
   *
   * @params s1 string representing the first unit
   * @params s2 string representing the second unit
   * @returns a string representing the two units multiplied
   */
  mulString(s1, s2) {
    return s1 + "." + s2;
  }


  /**
   * Creates a unit string that indicates division of the first unit by
   * the second unit, as referenced by the codes passed in.
   *
   * @params s1 string representing the first unit
   * @params s2 string representing the second unit
   * @returns a string representing the division of the first unit by the
   * second unit
   */
  divString(s1, s2) {
    let ret = null;
    if(s2.length == 0)
      ret = s1;
    else {
      let t = s2.replace('/','1').replace('.','/').replace('1','.');

      switch (t[0]) {
        case '.':
          ret = s1 + t;
          break ;
        case '/':
          ret =  s1 + t;
          break;
        default:
          ret = s1 + "/" + t;
      }
    }
    return ret ;
  }

} // end class UnitString

