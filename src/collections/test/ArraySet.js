define(["dojo/main", "ppwcode/contracts/doh", "../ArraySet"],
  function(dojo, doh, ArraySet) {

    doh.register(ArraySet.prototype.declaredClass, [

      function testConstructor1a() {
        var subject = new ArraySet();
        doh.invars(subject);
        doh.is(Object, subject.getElementType());
        doh.is(0, subject.getSize());
        doh.t(subject.getEquivalence());
      }

    ]);

  }
);
